-- 크리스마스 게임 어드민 — 사람마다 몇 번 했고 어떻게 끝났나, 라운드마다 몇 판이 닿고 몇 판이 멈췄나(2026-11-27 대표님)
--
-- 랭킹에 등록하지 않은 사람까지 전부 본다. 판(xmas_game_runs) 하나의 결과를 이렇게 나눈다(outcome):
--   quit      5라운드를 마치지 않았다(중간에 그만뒀거나 창을 닫았다 — 지금 하고 있는 판도 여기 든다)
--   below     5라운드를 마쳤고 35점이 안 됐다
--   gift      35점을 넘기고 정답을 맞혀 이 판에서 선물 코드를 받았다
--   had_gift  35점을 넘겼는데 이 사람은 이미 앞 판에서 코드를 받았다(선물은 브라우저에 하나 — 이 판에는 코드가 안 적힌다)
--   wrong     35점을 넘기고 정답을 냈지만 틀리고 멈췄다
--   skip      35점을 넘기고 정답을 내지 않았다 —「기록만 남기기」 또는 정답 화면에서 나갔다
-- 화면: src/app/(site)/admin/xmas-game/. 서비스 키로만 부른다.

create or replace function public.xmas_game_admin()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with runs as (
    select r.*,
           (select min(g.gift_issued_at) from xmas_game_runs g
             where g.player_id = r.player_id and g.gift_code is not null) as player_gift_at
    from xmas_game_runs r
  ),
  classified as (
    select *,
           case
             when round < 5 then 'quit'
             when coalesce(score5, 0) < 35 then 'below'
             when gift_code is not null then 'gift'
             when player_gift_at is not null and player_gift_at <= coalesce(finished_at, now()) then 'had_gift'
             when answer_tries > 0 then 'wrong'
             else 'skip'
           end as outcome
    from runs
  ),
  players as (
    select player_id,
           max(nickname) as nickname,
           bool_or(hidden) as hidden,
           count(*) as runs,
           count(*) filter (where round >= 5) as finished,
           count(*) filter (where outcome = 'below') as below,
           count(*) filter (where outcome in ('gift', 'had_gift', 'wrong', 'skip')) as passed,
           count(*) filter (where outcome = 'skip') as skipped,
           count(*) filter (where outcome = 'wrong') as wrong_runs,
           coalesce(sum(answer_tries), 0) as wrong_answers,
           count(*) filter (where round >= 6) as bonus,
           coalesce(sum(cardinality(retried)), 0) as retries,
           max(score5) as best5,
           max(round) as best_round,
           max(score) filter (where round >= 5) as best_score,
           bool_or(gift_code is not null) as gift,
           bool_or(gift_redeemed_at is not null) as redeemed,
           (array_agg(react_ms order by finished_at desc nulls last) filter (where react_ms is not null))[1] as react_ms,
           min(started_at) as first_at,
           max(started_at) as last_at
    from classified
    group by player_id
  )
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(to_jsonb(p) order by p.last_at desc) from players p), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_object_agg(outcome, n) from (
      select outcome, count(*) as n from classified group by outcome) o), '{}'::jsonb),
    -- 라운드마다: reached 그 라운드까지 닿은 판, ended 그 라운드에서 끝난 판(20라운드는 다 깬 판도 든다)
    'rounds', (select jsonb_agg(jsonb_build_object(
        'round', r,
        'reached', (select count(*) from runs where round >= r),
        'ended', (select count(*) from runs where round = r)) order by r)
      from generate_series(5, 20) r),
    -- 5라운드 점수 분포(5라운드를 마친 판)
    'scores', coalesce((select jsonb_agg(jsonb_build_object('score', score5, 'runs', n) order by score5) from (
      select score5, count(*) as n from runs where round >= 5 and score5 is not null group by score5) s), '[]'::jsonb),
    'total_runs', (select count(*) from runs),
    'retries', (select coalesce(sum(cardinality(retried)), 0) from runs)
  );
$function$;

revoke all on function public.xmas_game_admin() from public, anon, authenticated;
grant execute on function public.xmas_game_admin() to service_role;
