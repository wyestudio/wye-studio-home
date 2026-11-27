-- 크리스마스 미니게임 「산타의 어드벤트 캘린더」 — 판 기록 · 랭킹 · 선물 코드(2026-11-26 대표님).
--
-- 적용: test 20261126062343 (적용 완료, 2026-11-26) / 운영 20261126062217 (적용 완료, 2026-11-27)
--       같은 날 선물 점수 37 → 35, 이어하기 10 → 20라운드로 바꾸면서 test 에는 xmas_game_submit · xmas_game_claim ·
--       xmas_game_stats 를 다시 실행해 이 파일과 맞췄다(표는 그대로). xmas_game_funnel 도 같은 날 test 에 더했다.
--
-- 테마 상세의 게임(src/components/xmas-game/)이 쓴다. 한 판이 한 줄이다 — 시작할 때 줄이 생기고,
-- 5라운드를 마치면 점수가 적히고, 닉네임을 넣으면 랭킹에 오르고, 정답을 맞히면 선물 코드가 붙는다.
--
-- ⚠️ 쓰기 · 읽기 모두 브라우저가 Supabase 로 **바로** 한다(아래 xmas_game_* 함수, anon 실행 가능).
--    Vercel 서버를 거치면 판 수만큼 함수가 돈다(wye-server-cost).
-- ⚠️ 표에는 anon 권한이 없다. 함수로만 닿고, 어드민(/xmas-game)은 서비스 키로 읽고 고친다.
-- ⚠️ player_id 는 게임 전용 무작위 번호다(브라우저 localStorage 'wye_xmas_player').
--    방문 발자취의 visitor_id 와 **잇지 않는다** — 닉네임이 신청 정보와 연결되면 안 된다.
-- ⚠️ 점수는 브라우저가 센다. 서버는 "나올 수 없는 값" 만 거른다(라운드별 최고점 · 최소 진행 시간).
--    마음먹고 꾸며 보내면 못 막는다 — 선물은 현장에서 코드를 한 번만 수령 처리하는 것으로 지킨다.
-- ⚠️ 정답(XMAS)은 화면에 글자로 나오는 값이라 감추는 값이 아니다. 문은 '35점' 이다.
-- ⚠️ v_max(라운드별 누적 최고점) · 라운드 범위(5~20)는 xmasGameEngine.ts 의 ROUNDS 와, 35점은 xmasGameShared.ts 의
--    XMAS_GIFT_GOAL 과 같아야 한다. 판 구성을 바꾸면 같이(문이 열려 있는 시간만 바꾸는 것은 상관없다).
--
-- 이벤트가 끝나면 표째 지워도 된다(다른 표가 참조하지 않는다).
--
-- 되돌리기:
--   drop function if exists public.xmas_game_funnel();
--   drop function if exists public.xmas_game_stats();
--   drop function if exists public.xmas_game_claim(uuid, uuid, text);
--   drop function if exists public.xmas_game_name(uuid, uuid, text);
--   drop function if exists public.xmas_game_submit(uuid, uuid, integer, integer, integer);
--   drop function if exists public.xmas_game_start(uuid, text);
--   drop function if exists public.xmas_game_board(uuid);
--   drop table if exists public.xmas_game_runs;

create table if not exists public.xmas_game_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  -- 어느 화면에서 했나(/themes/baotalchul)
  page text check (page is null or char_length(page) <= 80),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- 마지막으로 마친 라운드. 0 = 시작만 하고 5라운드를 못 마쳤다
  round smallint not null default 0,
  score smallint not null default 0,
  -- 5라운드를 마친 순간의 점수 — 선물 자격(35점)은 이어하기 점수가 아니라 이 값으로 본다
  score5 smallint,
  max_combo smallint not null default 0,
  -- 랭킹에 공개되는 이름. 없으면 랭킹에 안 오른다
  nickname text check (nickname is null or char_length(nickname) between 1 and 10),
  answer_tries smallint not null default 0,
  gift_code text unique,
  gift_issued_at timestamptz,
  -- 현장에서 선물을 건넨 시각(어드민). 한 번 찍히면 같은 코드로 또 받을 수 없다
  gift_redeemed_at timestamptz,
  -- 랭킹에서만 감춘다(부적절한 닉네임 · 꾸민 점수)
  hidden boolean not null default false
);
create index if not exists xmas_game_runs_player on public.xmas_game_runs (player_id, started_at);
create index if not exists xmas_game_runs_started on public.xmas_game_runs (started_at);
create index if not exists xmas_game_runs_rank on public.xmas_game_runs (score desc)
  where nickname is not null and not hidden and round >= 5;
-- 선물 코드는 브라우저 하나에 하나
create unique index if not exists xmas_game_runs_one_gift on public.xmas_game_runs (player_id)
  where gift_code is not null;
alter table public.xmas_game_runs enable row level security;
revoke all on public.xmas_game_runs from anon, authenticated;
-- ⚠️ 이 프로젝트는 새 표에 service_role 권한이 자동으로 붙지 않는다.
grant select, insert, update, delete on public.xmas_game_runs to service_role;

comment on table public.xmas_game_runs is '크리스마스 미니게임 판 기록 · 랭킹 · 선물 코드. 어드민 /xmas-game 에서 본다.';

-- ── 랭킹: 사람(브라우저)마다 가장 좋은 판 하나. 위 3명과 내 순위 ──
create or replace function public.xmas_game_board(p_player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with best as (
    select distinct on (player_id) player_id, nickname, score, round, max_combo, finished_at
    from xmas_game_runs
    where nickname is not null and not hidden and round >= 5
    order by player_id, score desc, max_combo desc, finished_at
  ),
  ranked as (
    select b.*, row_number() over (order by b.score desc, b.max_combo desc, b.finished_at) as pos
    from best b
  )
  select jsonb_build_object(
    'players', (select count(*) from ranked),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.pos, 'name', r.nickname, 'score', r.score, 'round', r.round,
               'me', coalesce(r.player_id = p_player, false)) order by r.pos)
      from ranked r where r.pos <= 3), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', r.pos, 'name', r.nickname, 'score', r.score, 'round', r.round)
           from ranked r where r.player_id = p_player)
  );
$function$;

-- ── 판 시작: 줄을 만들고 번호를 돌려준다. 끝낼 때 "얼마나 걸렸나" 를 서버 시계로 잰다 ──
create or replace function public.xmas_game_start(p_player uuid, p_page text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_player is null then
    return null;
  end if;
  -- 한 브라우저 하루 300판, 전체 한 시간 3,000판을 넘기면 더 받지 않는다(고장 난 화면 · 장난 방지).
  -- 번호를 못 받아도 게임은 된다 — 랭킹 · 선물만 안 된다.
  if (select count(*) from xmas_game_runs where player_id = p_player and started_at > now() - interval '1 day') >= 300 then
    return null;
  end if;
  if (select count(*) from xmas_game_runs where started_at > now() - interval '1 hour') >= 3000 then
    return null;
  end if;
  insert into xmas_game_runs (player_id, page) values (p_player, left(p_page, 80)) returning id into v_id;
  return v_id;
end;
$function$;

-- ── 점수 기록: 5라운드를 마쳤을 때, 이어하기(6~20라운드)가 끝났을 때 ──
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
     and p_round > v_run.round
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

-- ── 닉네임 등록 · 바꾸기: 그 사람의 판 전부에 같은 이름을 붙인다 ──
create or replace function public.xmas_game_name(p_run uuid, p_player uuid, p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_ok boolean := false;
begin
  -- 줄바꿈 · 탭 · 폭 없는 글자(U+200B~200D · FEFF)를 한 칸으로 줄인다. 글자를 직접 적지 않고 \u 로 적는다(복사하다 사라진다)
  v_name := btrim(regexp_replace(coalesce(p_nickname, ''), '[[:space:][:cntrl:]\u200B-\u200D\uFEFF]+', ' ', 'g'));
  if char_length(v_name) between 1 and 10
     and exists (select 1 from xmas_game_runs where id = p_run and player_id = p_player and round >= 5)
  then
    update xmas_game_runs set nickname = v_name where player_id = p_player and round >= 5;
    v_ok := true;
  end if;
  return xmas_game_board(p_player) || jsonb_build_object('ok', v_ok);
end;
$function$;

-- ── 정답 제출: 5라운드 35점 이상인 판에서 맞히면 선물 코드를 준다 ──
create or replace function public.xmas_game_claim(p_run uuid, p_player uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_run xmas_game_runs%rowtype;
  v_code text;
  -- 헷갈리는 글자(I · L · O · U · 0 · 1)를 뺀 30자 — 현장에서 눈으로 대조한다
  v_abc constant text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
begin
  select * into v_run from xmas_game_runs where id = p_run and player_id = p_player for update;
  if not found or coalesce(v_run.score5, -999) < 35 then
    return jsonb_build_object('ok', false, 'reason', 'score');
  end if;
  if v_run.answer_tries >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'tries');
  end if;
  -- 대소문자 · 띄어쓰기 · 줄표(x-mas, X MAS, xmas)는 가리지 않는다
  if regexp_replace(upper(normalize(coalesce(p_answer, ''), NFKC)), '[^A-Z]', '', 'g') <> 'XMAS' then
    update xmas_game_runs set answer_tries = answer_tries + 1 where id = p_run;
    return jsonb_build_object('ok', false, 'reason', 'answer');
  end if;

  -- 이 브라우저가 이미 받은 코드가 있으면 그 코드를 다시 보여준다(여러 번 깨도 선물은 하나)
  select gift_code into v_code from xmas_game_runs
  where player_id = p_player and gift_code is not null limit 1;
  if v_code is not null then
    return jsonb_build_object('ok', true, 'code', v_code);
  end if;

  loop
    select string_agg(substr(v_abc, 1 + get_byte(gen_random_bytes(1), 0) % 30, 1), '')
      into v_code from generate_series(1, 6);
    begin
      update xmas_game_runs set gift_code = v_code, gift_issued_at = now() where id = p_run;
      exit;
    exception when unique_violation then
      -- 같은 브라우저의 다른 판이 방금 받았으면 그 코드를, 코드가 겹친 것이면 다시 뽑는다
      select gift_code into v_code from xmas_game_runs
      where player_id = p_player and gift_code is not null limit 1;
      exit when v_code is not null;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'code', v_code);
end;
$function$;

-- ── 난이도 확인(어드민): 사람(브라우저) 기준으로 몇 명이 선물 점수를 넘고, 이어하기에서 어디까지 갔나 ──
-- 목표(2026-11-26 대표님): 세 판 안에 80% 가 선물 점수를 넘고, 이어하기는 17라운드 이상 10% · 20라운드 5%.
-- (같은 날 "라운드가 갈수록 반드시 빨라져야 한다, 비율은 낮아져도 된다" 로 바뀌었다 — 이 숫자는 참고용이다.)
-- 여기 숫자가 너무 낮거나 높으면 xmasGameEngine.ts 의 show(문이 열려 있는 시간) · BONUS_PASS_RATE 를 고친다.
create or replace function public.xmas_game_stats()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with done as (
    select player_id, round, score5,
           row_number() over (partition by player_id order by started_at) as nth
    from xmas_game_runs
    where round >= 5
  ),
  per as (
    select player_id,
           bool_or(score5 >= 35) as passed,
           bool_or(score5 >= 35 and nth <= 3) as passed3,
           max(round) as best
    from done
    group by player_id
  )
  select jsonb_build_object(
    -- 다섯 라운드를 한 번이라도 마친 사람
    'players', count(*),
    'passed', count(*) filter (where passed),
    -- 처음 세 판 안에 넘긴 사람
    'passed3', count(*) filter (where passed3),
    -- 이어하기를 해 본 사람(6라운드 이상)
    'bonus', count(*) filter (where best >= 6),
    'r17', count(*) filter (where best >= 17),
    'r20', count(*) filter (where best >= 20)
  )
  from per;
$function$;

revoke all on function public.xmas_game_stats() from public, anon, authenticated;
grant execute on function public.xmas_game_stats() to service_role;

-- ── 참여 현황(어드민): 이벤트 블록을 본 사람부터 신청까지, 사람(브라우저) 수로 ──
-- 방문 발자취(visit_events)에서 센다 — 게임 화면의 방문과 xmas_game_* 이벤트(src/components/xmas-game/xmasGameShared.ts 의
-- XMAS_GAME_EVENT). 판 기록(xmas_game_runs)과는 사람을 잇지 않는다: 저쪽 번호(player_id)는 일부러 방문 번호와 다르게 뒀다.
-- guests 는 손님만, everyone 은 우리 기기(/internal 에서 켠 것)까지.
-- ⚠️ 방문 발자취는 60일 뒤 지워진다. 이벤트가 끝나고 두 달이 지나면 이 숫자는 0 으로 돌아간다.
-- ⚠️ via_share 는 공유 주소(/santa-calendar/r/…)를 연 사람이다. 공유한 본인이 눌러 본 것도 들어간다.
create or replace function public.xmas_game_funnel()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with ev as (
    select visitor_id, internal, kind, name, at
    from visit_events
    where (kind = 'event' and name like 'xmas\_game\_%')
       or (kind = 'page' and name like '/santa-calendar%')
  ),
  per as (
    select visitor_id,
           bool_or(internal) as internal,
           bool_or(name = 'xmas_game_view') as viewed,
           bool_or(name = 'xmas_game_open') as opened,
           bool_or(kind = 'page') as visited,
           bool_or(kind = 'page' and name like '/santa-calendar/r/%') as via_share,
           bool_or(name = 'xmas_game_start') as started,
           bool_or(name in ('xmas_game_fail', 'xmas_game_pass')) as finished,
           bool_or(name = 'xmas_game_pass') as passed,
           bool_or(name = 'xmas_game_gift') as gift,
           bool_or(name = 'xmas_game_rank') as ranked,
           bool_or(name = 'xmas_game_share') as shared,
           bool_or(name = 'xmas_game_apply') as apply_click,
           min(at) filter (where name = 'xmas_game_start') as first_start
    from ev
    group by visitor_id
  ),
  marked as (
    select p.*,
           -- 게임을 시작한 뒤에 신청을 마친 사람
           p.started and exists (
             select 1 from visitor_links l
             where l.visitor_id = p.visitor_id and l.application_id is not null and l.created_at >= p.first_start
           ) as applied
    from per p
  ),
  counted as (
    select g.guests_only,
           jsonb_build_object(
             'viewed', count(*) filter (where viewed),
             'opened', count(*) filter (where opened),
             'visited', count(*) filter (where visited),
             'via_share', count(*) filter (where via_share),
             'started', count(*) filter (where started),
             'finished', count(*) filter (where finished),
             'passed', count(*) filter (where passed),
             'gift', count(*) filter (where gift),
             'ranked', count(*) filter (where ranked),
             'shared', count(*) filter (where shared),
             'apply_click', count(*) filter (where apply_click),
             'applied', count(*) filter (where applied)
           ) as numbers
    from (values (true), (false)) as g(guests_only)
    left join marked m on (not g.guests_only or not m.internal)
    group by g.guests_only
  )
  select jsonb_build_object(
    'guests', (select numbers from counted where guests_only),
    'everyone', (select numbers from counted where not guests_only)
  );
$function$;

revoke all on function public.xmas_game_funnel() from public, anon, authenticated;
grant execute on function public.xmas_game_funnel() to service_role;

revoke all on function public.xmas_game_board(uuid) from public;
revoke all on function public.xmas_game_start(uuid, text) from public;
revoke all on function public.xmas_game_submit(uuid, uuid, integer, integer, integer) from public;
revoke all on function public.xmas_game_name(uuid, uuid, text) from public;
revoke all on function public.xmas_game_claim(uuid, uuid, text) from public;
grant execute on function public.xmas_game_board(uuid) to anon, authenticated, service_role;
grant execute on function public.xmas_game_start(uuid, text) to anon, authenticated, service_role;
grant execute on function public.xmas_game_submit(uuid, uuid, integer, integer, integer) to anon, authenticated, service_role;
grant execute on function public.xmas_game_name(uuid, uuid, text) to anon, authenticated, service_role;
grant execute on function public.xmas_game_claim(uuid, uuid, text) to anon, authenticated, service_role;
