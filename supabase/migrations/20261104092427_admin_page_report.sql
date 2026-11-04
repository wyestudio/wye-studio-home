-- 어드민 「방문 분석 → 페이지 보고서」 — 화면 하나에서 사람들이 무엇을 했나(2026-11-04 대표님).
-- 홈 · 테마 상세 · 단체 예약처럼 한 경로(p_path)만 골라 본다.
--
--   median_secs  그 화면에 머문 시간(방문마다 page_leave 를 더한 값의 중간값)
--   scroll       사람마다 가장 깊이 내려온 곳(%) — 25 · 50 · 75 · 끝까지(95% 이상)
--   sections     블록 열람(detail_section_view · group_section_view) — 블록별 도달 사람 수
--   clicks       누른 것과 누른 위치(y: 화면 위에서 몇 % 지점, 중간값)
--   fields       채운 입력칸(field_filled — 값은 없고 칸 이름만)
--   mascots      마스코트를 골라 커서를 바꾼 사람(mascot_select) · 끌어서 던진 사람(mascot_throw)
--   events       그 밖의 분석 이벤트(회차 고름 · 신청 시작 · 견적 접수 …)별 사람 수
-- 우리 기기(internal)는 뺀다. 기록은 src/lib/visitTrack.ts.
--
-- 되돌리기: drop function if exists public.admin_page_report(timestamptz, timestamptz, text);

create or replace function public.admin_page_report(p_since timestamptz, p_until timestamptz, p_path text)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  with ev as (
    select * from visit_events
    where at >= p_since and at < p_until and not internal
  ),
  pg as (select * from ev where path = p_path),
  stay as (
    select visit_id, visitor_id,
           sum((meta ->> 'secs')::numeric) as secs,
           max((meta ->> 'scroll')::numeric) as scroll
    from pg where kind = 'event' and name = 'page_leave'
    group by 1, 2
  ),
  vis as (
    select visit_id,
           (array_agg(name order by at, id) filter (where kind = 'page'))[1] as first_page,
           (array_agg(name order by at desc, id desc) filter (where kind = 'page'))[1] as last_page
    from ev group by visit_id
  )
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from ev where kind = 'page' and name = p_path),
    'views', (select count(*) from ev where kind = 'page' and name = p_path),
    'entries', (select count(*) from vis where first_page = p_path),
    'exits', (select count(*) from vis where last_page = p_path),
    'median_secs', (select coalesce(round(percentile_cont(0.5) within group (order by secs)), 0) from stay),
    'scroll', (
      select jsonb_build_object(
        'n', count(*),
        'p25', count(*) filter (where s >= 25),
        'p50', count(*) filter (where s >= 50),
        'p75', count(*) filter (where s >= 75),
        'p100', count(*) filter (where s >= 95)
      ) from (select visitor_id, max(scroll) as s from stay group by 1) x
    ),
    'sections', (
      select coalesce(jsonb_agg(x order by x.idx nulls last, x.visitors desc), '[]') from (
        select coalesce(meta ->> 'sectionLabel', meta ->> 'sectionKey') as label,
               min((meta ->> 'sectionIndex')::int) as idx,
               count(distinct visitor_id) as visitors
        from pg where kind = 'event' and name in ('detail_section_view', 'group_section_view')
        group by 1
      ) x
    ),
    'clicks', (
      select coalesce(jsonb_agg(x order by x.visitors desc, x.clicks desc), '[]') from (
        select name, count(distinct visitor_id) as visitors, count(*) as clicks,
               round(percentile_cont(0.5) within group (order by (meta ->> 'y')::numeric)) as y
        from pg where kind = 'click' and name <> '(가려진 영역)'
        group by name order by 2 desc, 3 desc limit 20
      ) x
    ),
    'fields', (
      select coalesce(jsonb_agg(x order by x.visitors desc), '[]') from (
        select meta ->> 'sectionLabel' as field, count(distinct visitor_id) as visitors
        from pg where kind = 'event' and name = 'field_filled' group by 1
      ) x
    ),
    'mascots', (
      select coalesce(jsonb_agg(x order by x.visitors desc), '[]') from (
        select meta ->> 'sectionLabel' as mascot,
               count(distinct visitor_id) filter (where name = 'mascot_select') as visitors,
               count(*) filter (where name = 'mascot_select') as times,
               count(distinct visitor_id) filter (where name = 'mascot_throw') as throwers
        from pg where kind = 'event' and name in ('mascot_select', 'mascot_throw') group by 1
      ) x
    ),
    'events', (
      select coalesce(jsonb_object_agg(name, n), '{}') from (
        select name, count(distinct visitor_id) as n
        from pg
        where kind = 'event'
          and name not in ('page_leave', 'field_filled', 'mascot_select', 'mascot_throw', 'detail_section_view', 'group_section_view')
        group by 1
      ) x
    )
  );
$function$;

revoke all on function public.admin_page_report(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.admin_page_report(timestamptz, timestamptz, text) to service_role;
