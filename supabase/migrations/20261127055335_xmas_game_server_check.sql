-- 크리스마스 게임 「산타의 어드벤트 캘린더」 — 점수를 서버가 다시 계산한다(2026-11-27 대표님)
--
-- 막으려는 것(대표님: "절대 못 막는 건 못 막더라도 최소한 이것까지는")
--   - 점수만 고쳐 보내기 · 개발자도구로 값 바꾸기 → 점수를 화면에서 받지 않는다. 누른 기록으로 여기서 센다
--   - 사람이 낼 수 없는 속도 → 문이 열리고 0.1초 안에 누른 기록이 있으면 받지 않는다.
--     반응 속도 중앙값이 0.17초 밑이면(사람은 대개 0.3~0.6초) 랭킹에서 숨기고(hidden) 어드민이 본다
--   - 시간을 줄여 꾸민 기록 → 문이 열리는 간격이 게임의 최소 간격보다 짧거나, 기록상 시간이 서버 시계로 흐른 시간보다 길면 받지 않는다
-- 못 막는 것: 사람 속도를 흉내 내는 정교한 봇. 상위 랭킹은 어드민에서 눈으로 본다(대표님).
--
-- 흐름
--   xmas_game_start2   판을 열고 20라운드 문 패(누가 어느 순서로 나오나)를 서버가 정해 준다
--   xmas_game_retry    공유하고 재도전 — 떨어진 라운드의 문 패를 새로 준다(한 라운드 한 번)
--   xmas_game_submit2  라운드마다 {o: 문이 열린 시각들, h: [몇 번째 문, 누른 시각]들}(ms, 라운드 시작 기준)을 받아
--                      점수 · 5라운드 점수 · 최대 콤보를 여기서 센다
-- 문 패의 숫자: 0 눈사람 · 1 루돌프 · 2 산타 · 3 글자 든 산타(1~5라운드). 눈사람 · 루돌프 +1, 산타 -1.
-- 라운드 상수(문 수 · 열려 있는 시간 · 쉬는 시간)는 src/components/xmas-game/xmasGameEngine.ts 의 ROUNDS 와 같아야 한다.
--
-- 옛 함수(xmas_game_start · xmas_game_submit)는 새 화면이 운영에 나간 뒤 손님 화면에서 부를 수 없게 막는다(맨 아래).
-- 운영 적용 순서: 이 파일 위쪽 → 코드 배포 → 맨 아래 「배포 뒤」 블록.

alter table public.xmas_game_runs add column if not exists decks jsonb;
alter table public.xmas_game_runs add column if not exists retried smallint[] not null default '{}';
alter table public.xmas_game_runs add column if not exists react_ms smallint;

comment on column public.xmas_game_runs.decks is '서버가 정한 20라운드 문 패(0 눈사람 · 1 루돌프 · 2 산타 · 3 글자 든 산타)';
comment on column public.xmas_game_runs.retried is '공유하고 재도전한 라운드';
comment on column public.xmas_game_runs.react_ms is '마지막으로 받은 기록의 반응 속도 중앙값(ms) — 어드민이 이상한 기록을 볼 때';

-- ── 라운드 상수(1부터) ──
create or replace function public.xmas_game_round_spec(p_round integer)
returns table (n integer, show integer, gap integer)
language sql
immutable
as $function$
  select (array[12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30])[p_round],
         (array[1620, 1230, 920, 680, 480, 465, 460, 455, 450, 445, 440, 435, 430, 425, 420, 415, 410, 405, 400, 395])[p_round],
         (array[330, 225, 155, 110, 85, 80, 80, 80, 75, 75, 75, 75, 75, 70, 70, 70, 70, 70, 70, 70])[p_round];
$function$;

-- ── 한 라운드의 문 패: 눈사람 · 루돌프 · 산타를 고루 섞고, 산타 하나(1~5라운드는 글자 든 산타)를 맨 앞뒤가 아닌 곳에 끼운다 ──
create or replace function public.xmas_game_make_deck(p_round integer)
returns jsonb
language plpgsql
volatile
as $function$
declare
  v_n integer;
  v_cards integer[];
  v_pos integer;
begin
  select n into v_n from xmas_game_round_spec(p_round);
  select array_agg(k order by random()) into v_cards
  from (select i % 3 as k from generate_series(0, v_n - 2) i) s;
  v_pos := 2 + floor(random() * (array_length(v_cards, 1) - 3))::integer;
  v_cards := v_cards[1:v_pos] || (case when p_round <= 5 then 3 else 2 end) || v_cards[v_pos + 1:];
  return to_jsonb(v_cards);
end;
$function$;

-- ── 판 시작: 번호와 20라운드 문 패 ──
create or replace function public.xmas_game_start2(p_player uuid, p_page text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_decks jsonb;
begin
  -- 하루 · 한 시간 판 수 제한은 원래 함수가 한다
  v_id := xmas_game_start(p_player, p_page);
  if v_id is null then
    return null;
  end if;
  select jsonb_agg(xmas_game_make_deck(r) order by r) into v_decks from generate_series(1, 20) r;
  update xmas_game_runs set decks = v_decks where id = v_id;
  return jsonb_build_object('id', v_id, 'decks', v_decks);
end;
$function$;

-- ── 공유하고 재도전: 떨어진 라운드(서버에 적힌 라운드)의 문 패를 새로 준다. 한 라운드에 한 번 ──
create or replace function public.xmas_game_retry(p_run uuid, p_player uuid, p_round integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run xmas_game_runs%rowtype;
  v_deck jsonb;
begin
  select * into v_run from xmas_game_runs where id = p_run and player_id = p_player for update;
  if not found or v_run.decks is null or p_round not between 6 and 20
     or v_run.round <> p_round or p_round = any(v_run.retried) then
    return null;
  end if;
  v_deck := xmas_game_make_deck(p_round);
  update xmas_game_runs
  set decks = jsonb_set(decks, array[(p_round - 1)::text], v_deck),
      retried = retried || p_round::smallint
  where id = p_run;
  return v_deck;
end;
$function$;

-- ── 점수 기록: 누른 기록으로 여기서 센다 ──
create or replace function public.xmas_game_submit2(p_run uuid, p_player uuid, p_round integer, p_log jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run xmas_game_runs%rowtype;
  v_spec record;
  v_deck jsonb;
  v_o jsonb;
  v_h jsonb;
  v_tap jsonb;
  v_taps integer[];
  v_idx integer;
  v_open integer;
  v_prev_open integer;
  v_prev_tap integer;
  v_prev_kind integer;
  v_kind integer;
  v_t integer;
  v_min integer;
  v_round_pts integer;
  v_scorable integer;
  v_score integer := 0;
  v_score5 integer;
  v_combo integer := 0;
  v_peak integer := 0;
  v_reacts integer[] := '{}';
  v_total_ms bigint := 0;
  v_median numeric;
begin
  select * into v_run from xmas_game_runs where id = p_run and player_id = p_player for update;
  if not found or v_run.decks is null or p_round is null or p_round not between 5 and 20
     or p_log is null or jsonb_typeof(p_log) <> 'array' or jsonb_array_length(p_log) <> p_round
     or not (p_round > v_run.round or (p_round = v_run.round and p_round > 5))
     or now() - v_run.started_at >= interval '3 hours' then
    return xmas_game_board(p_player) || jsonb_build_object('ok', false);
  end if;

  begin
    for v_r in 1..p_round loop
      select * into v_spec from xmas_game_round_spec(v_r);
      v_deck := v_run.decks -> (v_r - 1);
      v_o := p_log -> (v_r - 1) -> 'o';
      v_h := p_log -> (v_r - 1) -> 'h';
      if jsonb_typeof(v_o) is distinct from 'array' or jsonb_array_length(v_o) <> v_spec.n
         or jsonb_typeof(v_h) is distinct from 'array' or jsonb_array_length(v_h) > v_spec.n then
        raise exception using errcode = 'XG001', message = 'shape';
      end if;

      -- 몇 번째 문을 언제 눌렀나(한 문은 한 번)
      v_taps := array_fill(null::integer, array[v_spec.n]);
      for v_tap in select * from jsonb_array_elements(v_h) loop
        if jsonb_typeof(v_tap) <> 'array' or jsonb_array_length(v_tap) <> 2 then
          raise exception using errcode = 'XG001', message = 'tap';
        end if;
        v_idx := (v_tap ->> 0)::integer;
        if v_idx < 0 or v_idx >= v_spec.n or v_taps[v_idx + 1] is not null then
          raise exception using errcode = 'XG001', message = 'tap index';
        end if;
        v_taps[v_idx + 1] := (v_tap ->> 1)::integer;
      end loop;

      v_round_pts := 0;
      v_scorable := 0;
      v_prev_open := null;
      for v_i in 0..v_spec.n - 1 loop
        v_open := (v_o ->> v_i)::integer;
        v_kind := (v_deck ->> v_i)::integer;
        v_t := v_taps[v_i + 1];
        if v_open is null or v_open < 0 then
          raise exception using errcode = 'XG001', message = 'open';
        end if;
        if v_prev_open is not null then
          -- 앞 문이 닫히고 쉬는 시간이 지나야 다음 문이 열린다. 누른 문(글자 든 산타 말고)은 일찍 닫힌다.
          -- 시계는 늦을 수는 있어도 빨라질 수는 없다 — 25ms 만 봐준다
          v_min := v_spec.gap - 25 + case
            when v_prev_tap is not null and v_prev_kind <> 3 then least(390, round(v_spec.show * 0.7))::integer
            else v_spec.show end;
          if v_open - v_prev_open < v_min or (v_prev_tap is not null and v_prev_tap >= v_open) then
            raise exception using errcode = 'XG001', message = 'timing';
          end if;
        end if;
        if v_kind in (0, 1) then
          v_scorable := v_scorable + 1;
        end if;
        if v_t is not null then
          -- 문이 열리고 0.1초 안에는 사람이 못 누른다. 닫힌 뒤에도 못 누른다
          if v_t - v_open < 100 or v_t > v_open + v_spec.show + 30 then
            raise exception using errcode = 'XG001', message = 'reaction';
          end if;
          v_reacts := v_reacts || (v_t - v_open);
          if v_kind in (0, 1) then
            v_round_pts := v_round_pts + 1;
            v_combo := v_combo + 1;
            v_peak := greatest(v_peak, v_combo);
          else
            v_round_pts := v_round_pts - 1;
            v_combo := 0;
          end if;
        elsif v_kind in (0, 1) then
          v_combo := 0;
        end if;
        v_prev_open := v_open;
        v_prev_tap := v_t;
        v_prev_kind := v_kind;
      end loop;

      v_score := v_score + v_round_pts;
      v_total_ms := v_total_ms + v_prev_open + v_spec.show;
      if v_r = 5 then
        v_score5 := v_score;
      end if;
      -- 이어하기는 그 라운드의 통과선(25%)을 넘겨야 다음 라운드로 간다
      if v_r >= 6 and v_r < p_round and v_round_pts < ceil(v_scorable * 0.25) then
        raise exception using errcode = 'XG001', message = 'pass';
      end if;
    end loop;

    -- 기록상 논 시간이 서버 시계로 흐른 시간보다 길 수 없다(카운트다운은 빼고 셌으니 넉넉하다)
    if v_total_ms > extract(epoch from now() - v_run.started_at) * 1000 + 3000 then
      raise exception using errcode = 'XG001', message = 'clock';
    end if;
  exception when sqlstate 'XG001' then
    return xmas_game_board(p_player) || jsonb_build_object('ok', false);
  end;

  -- 5라운드 점수(선물 자격)는 한 번 정해지면 바뀌지 않는다 — 6라운드 이후를 보내면서 앞 기록을 고쳐 끼우지 못하게
  -- 같은 라운드를 재도전해서 다시 보냈으면 점수가 올랐을 때만 바꾼다
  if (v_run.score5 is not null and v_score5 is distinct from v_run.score5)
     or (p_round = v_run.round and v_score <= v_run.score) then
    return xmas_game_board(p_player) || jsonb_build_object('ok', false);
  end if;

  if array_length(v_reacts, 1) > 0 then
    select percentile_cont(0.5) within group (order by x) into v_median from unnest(v_reacts) x;
  end if;

  update xmas_game_runs r
  set round = p_round,
      score = v_score,
      score5 = v_score5,
      max_combo = greatest(r.max_combo, v_peak),
      finished_at = now(),
      react_ms = least(v_median, 32000)::smallint,
      -- 반응 속도 중앙값이 사람 같지 않으면 랭킹에서 숨긴다(어드민이 보고 풀 수 있다)
      hidden = r.hidden or (array_length(v_reacts, 1) >= 20 and v_median < 170),
      -- 전에 등록한 닉네임이 있으면 이번 판에도 붙인다(다시 묻지 않는다)
      nickname = coalesce(r.nickname, (
        select o.nickname from xmas_game_runs o
        where o.player_id = p_player and o.nickname is not null and not o.hidden
        order by o.started_at desc limit 1))
  where r.id = p_run;
  return xmas_game_board(p_player) || jsonb_build_object('ok', true);
end;
$function$;

-- ── 닉네임: 공백만 · 보이지 않는 글자 · 위험한 글자는 받지 않는다(2026-11-27 대표님) ──
-- 일반 띄어쓰기는 된다(여러 칸은 한 칸으로 줄이고 앞뒤는 자른다). 공백만 넣은 이름은 안 된다.
-- 받지 않는 글자: 제어 문자 · 줄바꿈 · 폭 없는 공백 · 글자 방향 바꾸기(U+202A~202E · 2066~2069) · 한글 채움 문자(U+3164 · U+115F · U+1160 ·
-- U+FFA0) · 점자 빈칸(U+2800) · 전각 공백 등 띄어쓰기처럼 보이는 글자, 그리고 < > " ' ` \
-- 화면(src/components/xmas-game/xmasGameShared.ts 의 NICK_FORBIDDEN)과 같은 목록이다.
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
  v_name := coalesce(p_nickname, '');
  if v_name !~ '[[:cntrl:]\u00A0\u00AD\u034F\u061C\u115F\u1160\u1680\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0<>"''`\\]' then
    v_name := btrim(regexp_replace(v_name, ' +', ' ', 'g'));
    if char_length(v_name) between 1 and 10
       and exists (select 1 from xmas_game_runs where id = p_run and player_id = p_player and round >= 5)
    then
      update xmas_game_runs set nickname = v_name where player_id = p_player and round >= 5;
      v_ok := true;
    end if;
  end if;
  return xmas_game_board(p_player) || jsonb_build_object('ok', v_ok);
end;
$function$;

revoke all on function public.xmas_game_round_spec(integer) from public, anon, authenticated;
revoke all on function public.xmas_game_make_deck(integer) from public, anon, authenticated;
revoke all on function public.xmas_game_start2(uuid, text) from public;
revoke all on function public.xmas_game_retry(uuid, uuid, integer) from public;
revoke all on function public.xmas_game_submit2(uuid, uuid, integer, jsonb) from public;
grant execute on function public.xmas_game_start2(uuid, text) to anon, authenticated, service_role;
grant execute on function public.xmas_game_retry(uuid, uuid, integer) to anon, authenticated, service_role;
grant execute on function public.xmas_game_submit2(uuid, uuid, integer, jsonb) to anon, authenticated, service_role;

-- ── 배포 뒤: 옛 함수를 손님 화면에서 못 부르게 한다(점수를 그대로 받던 함수) ──
-- 새 화면이 운영에 나간 뒤에 실행한다. 함수는 남겨 둔다(xmas_game_start2 가 xmas_game_start 를 부른다).
revoke execute on function public.xmas_game_start(uuid, text) from anon, authenticated;
revoke execute on function public.xmas_game_submit(uuid, uuid, integer, integer, integer) from anon, authenticated;
