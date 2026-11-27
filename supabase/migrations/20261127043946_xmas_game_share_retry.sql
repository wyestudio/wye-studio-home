-- 크리스마스 게임 「산타의 어드벤트 캘린더」 — 친구에게 공유하고 재도전(2026-11-27 대표님)
--
-- 이어하기(6~20라운드)에서 떨어지면 그 라운드를 한 번 더 할 수 있다. 조건은 친구에게 공유한 것.
--   카카오톡: 정말 보냈는지 카카오가 알려 준다(카카오톡 공유 웹훅). 그 알림이 와야 "공유 완료" 다.
--     - 「나와의 채팅」 은 인정하지 않는다.
--     - 같은 브라우저(player_id)가 전에 인정받은 대화방에 다시 보내면 인정하지 않는다. 다른 브라우저(다른 사람)는
--       같은 단체방에 보내도 인정된다.
--   인스타그램 DM: 보냈는지 알 길이 없어 공유를 시도한 것으로 인정한다 — 화면만 안다. 이 표를 쓰지 않는다.
--   링크 복사: 인정하지 않는다.
--
-- 흐름
--   화면  xmas_game_share_begin  → 공유 표(token) 하나를 만든다. 카카오 공유에 serverCallbackArgs 로 실어 보낸다
--   카카오 → /api/xmas/kakao-share(웹훅) → xmas_game_share_confirm(service_role) → ok · dup · memo 로 적는다
--   화면  xmas_game_share_status → 이 브라우저로 돌아왔을 때 결과를 묻는다
--
-- 재도전을 몇 번 하는지(한 라운드에 한 번)는 화면이 센다. 점수는 원래부터 화면이 보내는 값을 믿는 구조라
-- 여기서 세어도 막을 수 있는 것이 없다 — 이 표가 지키는 것은 "카카오톡을 정말 보냈나" 하나다.

create table if not exists public.xmas_game_shares (
  token uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  run_id uuid not null references public.xmas_game_runs (id) on delete cascade,
  -- 떨어진 라운드(재도전할 라운드)
  round smallint not null check (round between 6 and 20),
  created_at timestamptz not null default now(),
  -- pending: 아직 카카오 알림이 없다 / ok: 인정 / dup: 이 브라우저가 전에 인정받은 방 / memo: 나와의 채팅
  status text not null default 'pending' check (status in ('pending', 'ok', 'dup', 'memo')),
  chat_type text check (chat_type is null or char_length(chat_type) <= 40),
  -- 카카오가 서비스마다 다르게 만들어 주는 대화방 값. 방이 누구인지는 알 수 없다
  chat_hash text check (chat_hash is null or char_length(chat_hash) <= 200),
  confirmed_at timestamptz
);

create index if not exists xmas_game_shares_player_room on public.xmas_game_shares (player_id, chat_hash)
  where status = 'ok';
create index if not exists xmas_game_shares_player_time on public.xmas_game_shares (player_id, created_at);

alter table public.xmas_game_shares enable row level security;
revoke all on public.xmas_game_shares from anon, authenticated;
-- ⚠️ 이 프로젝트는 새 표에 service_role 권한이 자동으로 붙지 않는다.
grant select, insert, update, delete on public.xmas_game_shares to service_role;

comment on table public.xmas_game_shares is '크리스마스 게임 — 카카오톡 공유하고 재도전. 카카오 웹훅으로 실제 전송을 확인한다.';

-- ── 공유 시작: 이 판이 정말 그 라운드에서 떨어졌을 때만 표를 만든다 ──
create or replace function public.xmas_game_share_begin(p_run uuid, p_player uuid, p_round integer)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token uuid;
begin
  if p_run is null or p_player is null or p_round not between 6 and 20 then
    return null;
  end if;
  -- 떨어진 라운드가 서버에 적힌 라운드와 같아야 한다(점수를 먼저 보낸 뒤에 부른다)
  if not exists (select 1 from xmas_game_runs where id = p_run and player_id = p_player and round = p_round) then
    return null;
  end if;
  -- 한 브라우저 한 시간 30번까지(고장 난 화면 · 장난 방지)
  if (select count(*) from xmas_game_shares where player_id = p_player and created_at > now() - interval '1 hour') >= 30 then
    return null;
  end if;
  insert into xmas_game_shares (player_id, run_id, round) values (p_player, p_run, p_round) returning token into v_token;
  return v_token;
end;
$function$;

-- ── 결과 묻기: 그 브라우저가 만든 표만 ──
create or replace function public.xmas_game_share_status(p_token uuid, p_player uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select status from xmas_game_shares where token = p_token and player_id = p_player;
$function$;

-- ── 카카오 알림 받기(웹훅이 service_role 로 부른다) ──
-- 같은 알림이 여러 번 와도(카카오는 응답이 없으면 다시 보낸다) 처음 한 번만 적는다(pending 일 때만 바꾼다).
create or replace function public.xmas_game_share_confirm(p_token text, p_chat_type text, p_chat_hash text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_share xmas_game_shares%rowtype;
  v_status text;
begin
  if p_token is null or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  select * into v_share from xmas_game_shares where token = p_token::uuid for update;
  if not found then
    return null;
  end if;
  if v_share.status <> 'pending' then
    return v_share.status;
  end if;
  v_status := case
    when p_chat_type = 'MemoChat' then 'memo'
    when p_chat_hash is not null and exists (
      select 1 from xmas_game_shares
      where player_id = v_share.player_id and status = 'ok' and chat_hash = p_chat_hash
    ) then 'dup'
    else 'ok'
  end;
  update xmas_game_shares
  set status = v_status,
      chat_type = left(p_chat_type, 40),
      chat_hash = left(p_chat_hash, 200),
      confirmed_at = now()
  where token = v_share.token;
  return v_status;
end;
$function$;

-- ── 점수 기록: 재도전에서 같은 라운드를 다시 마쳤을 때도 받는다(점수가 오른 경우만) ──
-- 20261126062217_xmas_game.sql 의 정의에서 `p_round > v_run.round` 한 줄만 바꿨다.
create or replace function public.xmas_game_submit(p_run uuid, p_player uuid, p_round integer, p_score integer, p_combo integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run xmas_game_runs%rowtype;
  -- 그 라운드까지 낼 수 있는 가장 높은 점수(눈사람 + 루돌프 수의 누적)
  v_max constant integer[] := array[8, 17, 27, 39, 52, 66, 82, 99, 117, 137,
                                    157, 177, 197, 217, 237, 257, 277, 297, 317, 337];
  v_ok boolean := false;
begin
  select * into v_run from xmas_game_runs where id = p_run and player_id = p_player for update;
  if found
     and p_round between 5 and 20
     and (p_round > v_run.round or (p_round = v_run.round and p_round > 5 and p_score > v_run.score))
     and p_score between -80 and v_max[p_round]
     and p_combo between 0 and v_max[p_round]
     -- 가장 빨리 해도 5라운드에 1분쯤 걸린다. 그보다 훨씬 빠르면 게임을 하지 않은 것이다
     and now() - v_run.started_at >= make_interval(secs => 40 + (p_round - 5) * 8)
     and now() - v_run.started_at < interval '3 hours'
  then
    update xmas_game_runs r
    set round = p_round,
        score = p_score,
        score5 = case when p_round = 5 then p_score else r.score5 end,
        max_combo = greatest(r.max_combo, p_combo),
        finished_at = now(),
        -- 전에 등록한 닉네임이 있으면 이번 판에도 붙인다(다시 묻지 않는다)
        nickname = coalesce(r.nickname, (
          select o.nickname from xmas_game_runs o
          where o.player_id = p_player and o.nickname is not null and not o.hidden
          order by o.started_at desc limit 1))
    where r.id = p_run;
    v_ok := true;
  end if;
  return xmas_game_board(p_player) || jsonb_build_object('ok', v_ok);
end;
$function$;

revoke all on function public.xmas_game_share_begin(uuid, uuid, integer) from public;
revoke all on function public.xmas_game_share_status(uuid, uuid) from public;
revoke all on function public.xmas_game_share_confirm(text, text, text) from public, anon, authenticated;
grant execute on function public.xmas_game_share_begin(uuid, uuid, integer) to anon, authenticated, service_role;
grant execute on function public.xmas_game_share_status(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.xmas_game_share_confirm(text, text, text) to service_role;
