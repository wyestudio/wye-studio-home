-- 크리스마스 게임 어드민 — 사람마다 몇 번째 판에서 무엇을 했나(2026-11-27 대표님)
--
-- 사람(브라우저, player_id)마다 판 목록을 시작한 순서대로 돌려준다 — 랭킹에 등록하지 않은 사람까지 전부.
-- 화면(src/app/(site)/admin/xmas-game/)이 이것으로 전체 랭킹 · 사람별 플레이 기록 · 라운드 도달 차트를 그린다.
--   n         그 사람의 몇 번째 판인가(시작한 순서, 5라운드를 못 마친 판도 센다)
--   round     마친 라운드(0 이면 5라운드를 마치지 않았다 — 그만뒀거나 하고 있다)
--   gift      이 판에서 정답을 맞혀 선물 코드를 받았다
--   had_gift  35점을 넘겼는데 이미 앞 판에서 코드를 받은 사람이다(선물은 브라우저에 하나 — 이 판엔 코드가 안 적힌다)
--   retries   이 판에서 공유하고 재도전한 횟수
-- 서비스 키로만 부른다.

create or replace function public.xmas_game_admin()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with runs as (
    select r.player_id, r.nickname, r.hidden, r.started_at, r.finished_at, r.round, r.score, r.score5,
           r.max_combo, r.answer_tries, r.react_ms, cardinality(r.retried) as retries,
           r.gift_code is not null as gift,
           row_number() over (partition by r.player_id order by r.started_at) as n,
           (select min(g.gift_issued_at) from xmas_game_runs g
             where g.player_id = r.player_id and g.gift_code is not null) as player_gift_at
    from xmas_game_runs r
  )
  select jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(p order by p->>'last_at' desc)
      from (
        select jsonb_build_object(
          'player_id', player_id,
          'nickname', max(nickname),
          'hidden', bool_or(hidden),
          'last_at', max(started_at),
          'runs', jsonb_agg(jsonb_build_object(
            'n', n,
            'started_at', started_at,
            'finished_at', finished_at,
            'round', round,
            'score', score,
            'score5', score5,
            'max_combo', max_combo,
            'answer_tries', answer_tries,
            'react_ms', react_ms,
            'retries', retries,
            'gift', gift,
            'had_gift', not gift and round >= 5 and coalesce(score5, 0) >= 35
                        and player_gift_at is not null and player_gift_at <= coalesce(finished_at, now())
          ) order by n)
        ) as p
        from runs
        group by player_id
      ) x), '[]'::jsonb)
  );
$function$;

revoke all on function public.xmas_game_admin() from public, anon, authenticated;
grant execute on function public.xmas_game_admin() to service_role;
