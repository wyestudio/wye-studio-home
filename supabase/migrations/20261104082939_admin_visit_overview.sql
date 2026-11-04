-- 어드민 「방문 분석」 — 기간 하나의 방문을 한 번에 요약한다(2026-11-04 대표님).
-- "오늘 몇 명이 와서 무엇을 봤고, 무엇을 몇 명이 눌렀나" 를 한 화면에.
--
-- 기록은 visit_events(src/lib/visitTrack.ts). 우리 기기(internal) 기록은 전부 뺀다.
-- 사람 = 브라우저(visitor_id). 같은 사람이 휴대폰 · 컴퓨터로 오면 2명이다.
-- 단계(funnel)는 "그 기간에 그 단계까지 간 사람 수" 다 — 순서를 강제하지 않는다.
-- applied_db 는 우리 기록이 아니라 applications 표에서 센 실제 신청 수다. 기록의
-- 'done'(신청 완료)과 나란히 놓아 기록이 제대로 잡히는지 보게 한다.
--
-- 되돌리기: drop function if exists public.admin_visit_overview(timestamptz, timestamptz);

create or replace function public.admin_visit_overview(p_since timestamptz, p_until timestamptz)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  with ev as (
    select * from visit_events
    where at >= p_since and at < p_until and not internal
  ),
  who as (select distinct visitor_id from ev),
  step as (
    -- 사람마다 이 기간에 닿은 단계
    select visitor_id,
           bool_or(kind = 'page' and name = '/') as home,
           bool_or(kind = 'page' and name ~ '^/themes/[^/]+$') as theme,
           bool_or(kind = 'event' and name = 'detail_session_pick') as pick,
           bool_or(kind = 'event' and name = 'detail_sold_out_click') as sold_out,
           bool_or((kind = 'event' and name = 'detail_apply_click') or (kind = 'page' and name ~ '^/themes/[^/]+/apply$')) as apply_click,
           bool_or(kind = 'event' and name = '신청 시작') as start,
           bool_or(kind = 'event' and name = '신청 약관동의') as consent,
           bool_or(kind = 'event' and name = '신청 제출단계') as submit_step,
           bool_or(kind = 'event' and name = '신청 완료') as done,
           bool_or(kind = 'page' and name = '/group') as group_page,
           bool_or(kind = 'event' and name = 'group_quote_start') as group_start,
           bool_or(kind = 'event' and name = 'group_quote_submit') as group_submit,
           bool_or(kind = 'page' and meta ->> 'dev' = 'mobile') as mobile
    from ev
    group by visitor_id
  )
  select jsonb_build_object(
    'visitors', (select count(*) from who),
    'visits', (select count(distinct visit_id) from ev),
    'pageviews', (select count(*) from ev where kind = 'page'),
    'new_visitors', (
      select count(*) from who w
      where not exists (select 1 from visit_events o where o.visitor_id = w.visitor_id and o.at < p_since)
    ),
    'mobile', (select count(*) from step where mobile),
    'applied_db', (
      select count(*) from applications
      where created_at >= p_since and created_at < p_until and not is_internal
    ),
    'funnel', (
      select jsonb_build_object(
        'home', count(*) filter (where home),
        'theme', count(*) filter (where theme),
        'pick', count(*) filter (where pick),
        'sold_out', count(*) filter (where sold_out),
        'apply_click', count(*) filter (where apply_click),
        'start', count(*) filter (where start),
        'consent', count(*) filter (where consent),
        'submit_step', count(*) filter (where submit_step),
        'done', count(*) filter (where done),
        'group_page', count(*) filter (where group_page),
        'group_start', count(*) filter (where group_start),
        'group_submit', count(*) filter (where group_submit)
      ) from step
    ),
    'pages', (
      select coalesce(jsonb_agg(x order by x.visitors desc, x.views desc), '[]') from (
        select name, count(distinct visitor_id) as visitors, count(*) as views
        from ev where kind = 'page' group by name order by 2 desc, 3 desc limit 10
      ) x
    ),
    'clicks', (
      -- 가려진 영역의 이름 없는 클릭은 뺀다 — 무엇을 눌렀는지 알 수 없다
      select coalesce(jsonb_agg(x order by x.visitors desc, x.clicks desc), '[]') from (
        select name, path, count(distinct visitor_id) as visitors, count(*) as clicks
        from ev where kind = 'click' and name <> '(가려진 영역)'
        group by name, path order by 3 desc, 4 desc limit 15
      ) x
    ),
    'sources', (
      select coalesce(jsonb_agg(x order by x.visitors desc), '[]') from (
        select meta ->> 'src' as src, count(distinct visitor_id) as visitors
        from ev where kind = 'page' and meta ? 'src' group by 1 order by 2 desc limit 10
      ) x
    ),
    'hours', (
      -- 한국 시간 0~23시별 방문자(기간 전체를 시각으로 겹쳐 센다)
      select coalesce(jsonb_object_agg(h, n), '{}') from (
        select extract(hour from at at time zone 'Asia/Seoul')::int as h, count(distinct visitor_id) as n
        from ev group by 1
      ) x
    ),
    'days', (
      select coalesce(jsonb_object_agg(d, n), '{}') from (
        select to_char(at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as d, count(distinct visitor_id) as n
        from ev group by 1
      ) x
    ),
    'since_first', (select min(at) from visit_events)
  );
$function$;

revoke all on function public.admin_visit_overview(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_visit_overview(timestamptz, timestamptz) to service_role;
