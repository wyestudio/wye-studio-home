-- 어드민 「방문 분석」 — 기간 하나의 방문을 한 번에 요약한다(2026-11-04 대표님).
-- "오늘 몇 명이 와서 무엇을 봤고, 무엇을 몇 명이 눌렀나" 를 한 화면에.
--
-- 기록은 visit_events(src/lib/visitTrack.ts). 우리 기기(internal) 기록은 전부 뺀다.
-- 사람 = 브라우저(visitor_id). 같은 사람이 휴대폰 · 컴퓨터로 오면 2명이다.
-- 단계(funnel)는 "그 기간에 그 단계까지 간 사람 수" 다 — 순서를 강제하지 않는다.
-- applied_db 는 우리 기록이 아니라 applications 표에서 센 실제 신청 수다. 기록의
-- 'done'(신청 완료)과 나란히 놓아 기록이 제대로 잡히는지 보게 한다.
-- by_source: 처음 유입별 전환 / by_device: 휴대폰 · 컴퓨터별 단계 / exits: 방문이 끝난 화면
-- engagement: 머문 시간(중간값) · 방문당 화면 수 · 화면 하나만 보고 아무것도 안 한 방문 수
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
           bool_or(kind = 'page' and meta ->> 'dev' = 'mobile') as mobile,
           bool_or(kind = 'page' and meta ->> 'dev' = 'desktop') as desktop,
           (array_agg(meta ->> 'src' order by at) filter (where kind = 'page' and meta ? 'src'))[1] as src
    from ev
    group by visitor_id
  ),
  vis as (
    -- 방문(30분 쉬면 새 방문) 하나하나 — 머문 시간 · 본 화면 수 · 나간 화면
    select visit_id,
           extract(epoch from max(at) - min(at)) as secs,
           count(*) filter (where kind = 'page') as pages,
           -- 화면을 떠난 기록(page_leave)은 '무엇을 했다' 가 아니다 — 세면 이탈률이 0 이 된다
           count(*) filter (where kind <> 'page' and name <> 'page_leave') as acts,
           (array_agg(name order by at desc, id desc) filter (where kind = 'page'))[1] as last_page
    from ev
    group by visit_id
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
      -- secs: 그 화면에 머문 시간의 중간값(방문마다 page_leave 를 더한 값)
      select coalesce(jsonb_agg(x order by x.visitors desc, x.views desc), '[]') from (
        select p.name, p.visitors, p.views, d.secs from (
          select name, count(distinct visitor_id) as visitors, count(*) as views
          from ev where kind = 'page' group by name order by 2 desc, 3 desc limit 10
        ) p
        left join (
          select path, round(percentile_cont(0.5) within group (order by s)) as secs from (
            select visit_id, path, sum((meta ->> 'secs')::numeric) as s
            from ev where kind = 'event' and name = 'page_leave' group by 1, 2
          ) z group by path
        ) d on d.path = p.name
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
    'engagement', (
      select jsonb_build_object(
        -- 머문 시간은 기록이 둘 이상인 방문만 — 화면 하나 열고 닫은 방문은 시간을 잴 수 없다
        'median_secs', coalesce(round(percentile_cont(0.5) within group (order by secs) filter (where pages + acts > 1)), 0),
        'pages_per_visit', coalesce(round(avg(pages), 1), 0),
        'bounce', count(*) filter (where pages <= 1 and acts = 0),
        'visits', count(*)
      ) from vis
    ),
    'exits', (
      select coalesce(jsonb_agg(x order by x.visits desc), '[]') from (
        select last_page as name, count(*) as visits from vis where last_page is not null
        group by 1 order by 2 desc limit 8
      ) x
    ),
    'by_source', (
      select coalesce(jsonb_agg(x order by x.visitors desc), '[]') from (
        select coalesce(src, '알 수 없음') as src, count(*) as visitors,
               count(*) filter (where pick) as pick,
               count(*) filter (where start) as start,
               count(*) filter (where done) as done
        from step group by 1 order by 2 desc limit 10
      ) x
    ),
    'by_device', (
      select jsonb_object_agg(dev, j) from (
        select dev, jsonb_build_object(
                 'visitors', count(*),
                 'theme', count(*) filter (where theme),
                 'pick', count(*) filter (where pick),
                 'apply_click', count(*) filter (where apply_click),
                 'start', count(*) filter (where start),
                 'consent', count(*) filter (where consent),
                 'submit_step', count(*) filter (where submit_step),
                 'done', count(*) filter (where done)
               ) as j
        from (select *, case when mobile then 'mobile' when desktop then 'desktop' end as dev from step) d
        where dev is not null
        group by dev
      ) x
    ),
    'since_first', (select min(at) from visit_events)
  );
$function$;

revoke all on function public.admin_visit_overview(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_visit_overview(timestamptz, timestamptz) to service_role;
