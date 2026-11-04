-- 방문 발자취 — 한 사람이 어디서 들어와 무엇을 보고 무엇을 눌렀는지(2026-11-04 대표님).
--
-- 우리는 회원이 없다. 브라우저에 무작위 번호(visitor_id)를 하나 붙여 그 브라우저의 페이지 이동 ·
-- 버튼 클릭 · 분석 이벤트(회차 선택 · 신청 단계 …)를 쌓고, 신청이 성공하면 서버가 그 번호를
-- 신청 건에 잇는다(visitor_links). 신청하지 않은 사람은 끝까지 번호로만 남는다.
--
-- ⚠️ 쓰기는 브라우저가 Supabase 로 **바로** 한다(track_events, anon 실행 가능).
--    Vercel 서버를 거치면 함수 호출 · CPU 가 방문 × 클릭 수만큼 늘어난다(wye-server-cost).
-- ⚠️ 입력칸 값 · 이름 · 전화번호는 보내지 않는다. 클릭은 버튼 글자만, 가려진 영역(data-clarity-mask)
--    안에서는 그마저 뺀다(src/components/analytics/VisitTracker.tsx).
-- ⚠️ 표에는 anon 권한이 없다. 쓰기는 track_events 로만, 읽기는 admin_* 함수(서비스 키)로만.
-- 90일이 지난 기록은 track_events 가 가끔(1%) 조금씩 지운다 — 크론을 따로 두지 않는다.
-- 무료 요금제 DB 500MB 안에 두려고 한 번에 50건, 브라우저 하나당 하루 3,000건까지만 받는다.
--
-- 되돌리기:
--   drop function if exists public.track_events(uuid, uuid, boolean, jsonb);
--   drop function if exists public.admin_visitor_list(timestamptz, text, integer, integer);
--   drop function if exists public.admin_visitor_events(uuid);
--   drop function if exists public.admin_customer_visitors(text);
--   drop function if exists public.admin_visitor_owner(uuid);
--   drop table if exists public.visitor_links;
--   drop table if exists public.visit_events;

create table if not exists public.visit_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  -- 한 번 들어와서 나갈 때까지(30분 쉬면 새 방문)
  visit_id uuid not null,
  at timestamptz not null default now(),
  -- page: 페이지 이동(name = 경로) / click: 버튼 · 링크(name = 글자) / event: 분석 이벤트(name = 이벤트 이름)
  kind text not null check (kind in ('page', 'click', 'event')),
  name text not null check (char_length(name) <= 80),
  path text check (char_length(path) <= 200),
  meta jsonb,
  -- 우리 기기(/internal 에서 켠 wye_internal 쿠키)
  internal boolean not null default false
);
create index if not exists visit_events_visitor_at on public.visit_events (visitor_id, at);
create index if not exists visit_events_at on public.visit_events (at);
alter table public.visit_events enable row level security;
revoke all on public.visit_events from anon, authenticated;

create table if not exists public.visitor_links (
  visitor_id uuid not null,
  application_id uuid references public.applications (id) on delete cascade,
  group_inquiry_id uuid references public.group_booking_inquiries (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (application_id is not null or group_inquiry_id is not null)
);
create unique index if not exists visitor_links_app on public.visitor_links (visitor_id, application_id) where application_id is not null;
create unique index if not exists visitor_links_group on public.visitor_links (visitor_id, group_inquiry_id) where group_inquiry_id is not null;
create index if not exists visitor_links_application on public.visitor_links (application_id);
alter table public.visitor_links enable row level security;
revoke all on public.visitor_links from anon, authenticated;
-- ⚠️ 이 프로젝트는 새 표에 service_role 권한이 자동으로 붙지 않는다. 신청 서버(attributionServer.ts)가
--    쓰고 어드민이 읽으므로 명시한다.
grant select, insert on public.visitor_links to service_role;

-- ── 쓰기: 브라우저가 몇 초마다 묶어서 보낸다 ──
create or replace function public.track_events(p_visitor uuid, p_visit uuid, p_internal boolean, p_events jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_visitor is null or p_visit is null or jsonb_typeof(p_events) <> 'array' then
    return;
  end if;
  -- 한 브라우저가 하루 3,000건을 넘기면 더 받지 않는다(고장 난 화면 · 장난 방지)
  if (select count(*) from visit_events where visitor_id = p_visitor and at > now() - interval '1 day') > 3000 then
    return;
  end if;

  insert into visit_events (visitor_id, visit_id, at, kind, name, path, meta, internal)
  select p_visitor, p_visit,
         -- 브라우저가 모아 두었다 보내므로 '몇 ms 전' 을 받는다. 브라우저 시계는 믿지 않는다.
         now() - make_interval(secs => least(greatest(coalesce((e ->> 'ago')::numeric, 0), 0), 600000) / 1000),
         e ->> 'kind',
         left(e ->> 'name', 80),
         left(e ->> 'path', 200),
         case when jsonb_typeof(e -> 'meta') = 'object' and pg_column_size(e -> 'meta') <= 1000 then e -> 'meta' end,
         coalesce(p_internal, false)
  from (select value as e from jsonb_array_elements(p_events) limit 50) x
  where e ->> 'kind' in ('page', 'click', 'event')
    and coalesce(e ->> 'name', '') <> ''
    and (e ->> 'ago') ~ '^[0-9]+(\.[0-9]+)?$';

  -- 90일이 지난 기록을 가끔 조금씩 지운다
  if random() < 0.01 then
    delete from visit_events
    where id in (select id from visit_events where at < now() - interval '90 days' order by at limit 5000);
  end if;
end;
$function$;

revoke all on function public.track_events(uuid, uuid, boolean, jsonb) from public;
grant execute on function public.track_events(uuid, uuid, boolean, jsonb) to anon, authenticated, service_role;

-- ── 읽기: 어드민 「방문 발자취」 ──
-- 단계: 1 회차 고름 · 2 신청하기 누름 · 3 신청 시작 · 4 약관 동의 · 5 제출 단계 · 6 신청 완료
create or replace function public.admin_visitor_list(p_since timestamptz, p_filter text, p_limit integer, p_offset integer)
returns table(
  visitor_id uuid, first_at timestamptz, last_at timestamptz, visits integer, pages integer, clicks integer,
  first_path text, first_source text, last_path text, stage integer, group_stage integer,
  applied boolean, customer_name text, phone_hash text, group_inquiry_id uuid, internal boolean, total_count bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
#variable_conflict use_column
begin
  return query
  with active as (
    select distinct ve.visitor_id as v from visit_events ve where ve.at >= p_since
  ),
  per as (
    select e.visitor_id as v,
           min(e.at) as f_at, max(e.at) as l_at,
           count(distinct e.visit_id)::int as n_visits,
           count(*) filter (where e.kind = 'page')::int as n_pages,
           count(*) filter (where e.kind = 'click')::int as n_clicks,
           max(case e.name
                 when '신청 완료' then 6 when '신청 제출단계' then 5 when '신청 약관동의' then 4
                 when '신청 시작' then 3 when 'detail_apply_click' then 2 when 'detail_session_pick' then 1
                 else 0 end) filter (where e.kind = 'event') as st,
           max(case e.name when 'group_quote_submit' then 2 when 'group_quote_start' then 1 else 0 end)
             filter (where e.kind = 'event') as gst,
           bool_or(e.internal) as inner_flag
    from visit_events e join active a on a.v = e.visitor_id
    group by e.visitor_id
  ),
  firsts as (
    select distinct on (e.visitor_id) e.visitor_id as v, e.name as f_path, e.meta ->> 'src' as f_src
    from visit_events e join active a on a.v = e.visitor_id
    where e.kind = 'page'
    order by e.visitor_id, e.at
  ),
  lasts as (
    select distinct on (e.visitor_id) e.visitor_id as v, e.name as l_path
    from visit_events e join active a on a.v = e.visitor_id
    where e.kind = 'page'
    order by e.visitor_id, e.at desc
  ),
  links as (
    select vl.visitor_id as v,
           (array_agg(vl.application_id order by vl.created_at desc) filter (where vl.application_id is not null))[1] as app_id,
           (array_agg(vl.group_inquiry_id order by vl.created_at desc) filter (where vl.group_inquiry_id is not null))[1] as g_id
    from visitor_links vl join active a on a.v = vl.visitor_id
    group by vl.visitor_id
  ),
  base as (
    select p.*, f.f_path, f.f_src, l.l_path, k.app_id, k.g_id,
           decrypt_pii(rep.name_enc) as c_name, rep.phone_hash as c_hash
    from per p
    left join firsts f on f.v = p.v
    left join lasts l on l.v = p.v
    left join links k on k.v = p.v
    left join lateral (
      select aa.name_enc, aa.phone_hash from application_attendees aa
      where aa.application_id = k.app_id order by aa.is_representative desc limit 1
    ) rep on true
    where case coalesce(p_filter, 'all')
            when 'applied' then k.app_id is not null or k.g_id is not null
            -- 신청을 시작했는데 끝내지 않은 사람
            when 'dropped' then coalesce(p.st, 0) between 3 and 5 and k.app_id is null
            -- 회차를 골랐거나 신청하기를 눌렀지만 신청 폼에는 안 간 사람
            when 'picked' then coalesce(p.st, 0) between 1 and 2 and k.app_id is null
            when 'group' then coalesce(p.gst, 0) > 0 or k.g_id is not null
            else true
          end
  ),
  counted as (select count(*) as n from base)
  select b.v, b.f_at, b.l_at, b.n_visits, b.n_pages, b.n_clicks, b.f_path, coalesce(b.f_src, '직접'), b.l_path,
         coalesce(b.st, 0), coalesce(b.gst, 0), b.app_id is not null, b.c_name, b.c_hash, b.g_id, b.inner_flag, c.n
  from base b, counted c
  order by b.l_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$function$;

create or replace function public.admin_visitor_events(p_visitor uuid)
returns table(at timestamptz, visit_id uuid, kind text, name text, path text, meta jsonb, internal boolean)
language sql
security definer
set search_path to 'public'
as $function$
  select e.at, e.visit_id, e.kind, e.name, e.path, e.meta, e.internal
  from visit_events e
  where e.visitor_id = p_visitor
  order by e.at, e.id
  limit 2000;
$function$;

-- 고객 한 사람(전화번호)이 **대표로** 낸 신청에 이어진 브라우저들.
-- 동행자는 뺀다 — 그 브라우저는 신청한 대표자의 것이다.
create or replace function public.admin_customer_visitors(p_phone_hash text)
returns table(visitor_id uuid, application_id uuid, linked_at timestamptz, events integer, first_at timestamptz, last_at timestamptz)
language sql
security definer
set search_path to 'public'
as $function$
  select vl.visitor_id, vl.application_id, vl.created_at,
         (select count(*)::int from visit_events e where e.visitor_id = vl.visitor_id),
         (select min(e.at) from visit_events e where e.visitor_id = vl.visitor_id),
         (select max(e.at) from visit_events e where e.visitor_id = vl.visitor_id)
  from visitor_links vl
  where vl.application_id in (
    select aa.application_id from application_attendees aa
    where aa.phone_hash = p_phone_hash and aa.is_representative
  )
  order by vl.created_at desc;
$function$;

-- 이 브라우저로 신청한 사람(가장 최근 신청의 대표자)
create or replace function public.admin_visitor_owner(p_visitor uuid)
returns table(name text, phone_hash text)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  select decrypt_pii(aa.name_enc), aa.phone_hash
  from visitor_links vl
  join application_attendees aa on aa.application_id = vl.application_id and aa.is_representative
  where vl.visitor_id = p_visitor
  order by vl.created_at desc
  limit 1;
$function$;

revoke all on function public.admin_visitor_owner(uuid) from public, anon, authenticated;
grant execute on function public.admin_visitor_owner(uuid) to service_role;
revoke all on function public.admin_visitor_list(timestamptz, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_visitor_events(uuid) from public, anon, authenticated;
revoke all on function public.admin_customer_visitors(text) from public, anon, authenticated;
grant execute on function public.admin_visitor_list(timestamptz, text, integer, integer) to service_role;
grant execute on function public.admin_visitor_events(uuid) to service_role;
grant execute on function public.admin_customer_visitors(text) to service_role;
