-- 어드민 「고객」 — 같은 전화번호를 한 사람으로 묶어 본다(2026-11-04 대표님).
--
-- 우리는 회원이 없다. 신청할 때 받은 참여자 전화번호(application_attendees.phone_hash)가
-- 같으면 같은 사람으로 본다. 대표자든 동행자든 똑같이 센다.
--
--   admin_customer_list       고객 한 명당 한 줄 — 검색 · 테마 · 재참여만 · 정렬 · 페이지
--   admin_customer_detail     한 사람의 신청 기록 전부(취소 포함)
--   admin_customer_retention  첫 참여 달별로 다시 온 사람 수
--
-- '참여' = 확정(confirmed) 신청이고 회차 시작이 지난 것. 예정은 확정 · 대기이면서 아직 안 한 것.
-- 결제액은 그 사람이 **대표로** 낸 신청의 입금 확인 금액만 더한다(동행자에게 나눠 붙이지 않는다).
-- 서비스 키 전용. 이름 · 전화번호를 복호화해 돌려준다.
--
-- 되돌리기:
--   drop function if exists public.admin_customer_list(text, uuid, boolean, text, integer, integer);
--   drop function if exists public.admin_customer_detail(text);
--   drop function if exists public.admin_customer_retention();

create or replace function public.admin_customer_list(
  p_query text,
  p_theme_id uuid,
  p_repeat_only boolean,
  p_sort text,
  p_limit integer,
  p_offset integer
)
returns table(
  phone_hash text, name text, phone text, nickname text,
  joined integer, upcoming integer, cancelled integer,
  themes text, paid_krw bigint, first_at timestamptz, last_at timestamptz,
  first_source text, internal boolean, total_count bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g');
begin
  return query
  with att as (
    select aa.phone_hash as h, aa.name_enc, aa.phone_enc, aa.nickname as nick, aa.created_at as a_created,
           aa.is_representative as rep,
           ap.id as app_id, ap.status as st, ap.payment_status as pay, ap.amount_krw as amt,
           ap.created_at as app_created, ap.utm_source as src, ap.referrer as ref, ap.is_internal as inner_flag,
           s.start_at as start_at, s.theme_id as theme_id,
           coalesce(t.name, s.theme_name) || coalesce(' ' || t.variant_label, '') as theme_label
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    left join themes t on t.id = s.theme_id
    where aa.phone_hash is not null
  ),
  per as (
    select h,
           count(distinct app_id) filter (where st = 'confirmed' and start_at < now())::int as joined_n,
           count(distinct app_id) filter (where st in ('confirmed', 'waiting') and start_at >= now())::int as upcoming_n,
           count(distinct app_id) filter (where st = 'cancelled')::int as cancelled_n,
           string_agg(distinct theme_label, ', ') filter (where st <> 'cancelled') as theme_list,
           coalesce(sum(amt) filter (where rep and pay = 'confirmed' and st <> 'cancelled'), 0)::bigint as paid,
           min(start_at) filter (where st <> 'cancelled') as first_start,
           max(start_at) filter (where st <> 'cancelled') as last_start,
           bool_or(inner_flag) as is_inner,
           bool_or(theme_id = p_theme_id) as has_theme
    from att
    group by h
  ),
  latest as (
    select distinct on (h) h, decrypt_pii(name_enc) as nm, decrypt_pii(phone_enc) as ph, nick
    from att
    order by h, a_created desc
  ),
  first_src as (
    -- 처음 신청할 때의 유입: utm_source → 다른 사이트에서 왔으면 그 주소의 도메인 → 직접
    select distinct on (h) h,
           coalesce(nullif(src, ''), substring(ref from '://(?:www\.)?([^/:]+)'), '직접') as first_from
    from att
    order by h, app_created
  ),
  base as (
    select p.*, l.nm, l.ph, l.nick, f.first_from
    from per p
    join latest l using (h)
    left join first_src f using (h)
    where (p_theme_id is null or p.has_theme)
      and (not coalesce(p_repeat_only, false) or p.joined_n + p.upcoming_n >= 2)
      and (v_q is null
           or l.nm ilike '%' || v_q || '%'
           or l.nick ilike '%' || v_q || '%'
           or (length(v_digits) >= 4 and regexp_replace(l.ph, '[^0-9]', '', 'g') like '%' || v_digits || '%'))
  ),
  counted as (select count(*) as n from base)
  select b.h, b.nm, b.ph, b.nick, b.joined_n, b.upcoming_n, b.cancelled_n, b.theme_list, b.paid,
         b.first_start, b.last_start, b.first_from, b.is_inner, c.n
  from base b, counted c
  order by
    case when p_sort = 'name_asc'    then b.nm end asc nulls last,
    case when p_sort = 'name_desc'   then b.nm end desc nulls last,
    case when p_sort = 'joined_desc' then b.joined_n + b.upcoming_n end desc,
    case when p_sort = 'joined_asc'  then b.joined_n + b.upcoming_n end asc,
    case when p_sort = 'paid_desc'   then b.paid end desc,
    case when p_sort = 'paid_asc'    then b.paid end asc,
    case when p_sort = 'first_asc'   then b.first_start end asc nulls last,
    case when p_sort = 'first_desc'  then b.first_start end desc nulls last,
    case when p_sort = 'last_asc'    then b.last_start end asc nulls last,
    b.last_start desc nulls last,
    b.h
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$function$;

create or replace function public.admin_customer_detail(p_phone_hash text)
returns table(
  application_id uuid, confirmation_code text, status text, payment_status text,
  is_representative boolean, headcount integer, amount_krw integer, coupons text,
  session_id uuid, session_start_at timestamptz, theme_label text,
  utm_source text, utm_medium text, utm_campaign text, referrer text, landing_path text,
  applied_at timestamptz, cancelled_at timestamptz,
  name text, phone text, nickname text, experience_range text, gender text, birth_year integer,
  companions text, internal boolean
)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  select ap.id, ap.confirmation_code, ap.status, ap.payment_status,
         aa.is_representative,
         (select count(*)::int from application_attendees x where x.application_id = ap.id),
         ap.amount_krw,
         (select string_agg(ac.campaign_name || ' ' || ac.code, ', ' order by ac.code)
            from application_coupons ac where ac.application_id = ap.id),
         s.id, s.start_at,
         coalesce(t.name, s.theme_name) || coalesce(' ' || t.variant_label, ''),
         ap.utm_source, ap.utm_medium, ap.utm_campaign, ap.referrer, ap.landing_path,
         ap.created_at, ap.cancelled_at,
         decrypt_pii(aa.name_enc), decrypt_pii(aa.phone_enc), aa.nickname, aa.experience_range, aa.gender, aa.birth_year,
         (select string_agg(decrypt_pii(o.name_enc), ', ' order by o.is_representative desc, o.created_at)
            from application_attendees o
           where o.application_id = ap.id and o.id <> aa.id),
         ap.is_internal
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  join sessions s on s.id = ap.session_id
  left join themes t on t.id = s.theme_id
  where aa.phone_hash = p_phone_hash
  order by s.start_at desc, ap.created_at desc;
$function$;

create or replace function public.admin_customer_retention()
returns table(cohort text, people integer, returned integer, returned_90d integer)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  -- 첫 참여(확정 · 회차가 지난 것) 달로 묶고, 그 뒤에 확정 신청이 하나라도 더 있으면 '다시 옴'.
  -- 다음 신청이 아직 안 한 회차여도 다시 온 것으로 센다 — 이미 다시 예약했으니까.
  with done as (
    select aa.phone_hash as h, s.start_at
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s on s.id = ap.session_id
    where aa.phone_hash is not null and ap.status = 'confirmed' and not ap.is_internal
  ),
  firsts as (
    select h, min(start_at) as first_start from done where start_at < now() group by h
  ),
  per as (
    select f.h, f.first_start,
           exists (select 1 from done d where d.h = f.h and d.start_at > f.first_start) as came_back,
           exists (select 1 from done d where d.h = f.h and d.start_at > f.first_start
                                          and d.start_at <= f.first_start + interval '90 days') as came_back_90
    from firsts f
  )
  select to_char(first_start at time zone 'Asia/Seoul', 'YYYY-MM'),
         count(*)::int,
         count(*) filter (where came_back)::int,
         count(*) filter (where came_back_90)::int
  from per
  group by 1
  order by 1;
$function$;

revoke all on function public.admin_customer_list(text, uuid, boolean, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_customer_detail(text) from public, anon, authenticated;
revoke all on function public.admin_customer_retention() from public, anon, authenticated;
grant execute on function public.admin_customer_list(text, uuid, boolean, text, integer, integer) to service_role;
grant execute on function public.admin_customer_detail(text) to service_role;
grant execute on function public.admin_customer_retention() to service_role;
