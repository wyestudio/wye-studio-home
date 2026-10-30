-- 어드민 신청 목록 검색 v2 — 조건을 나눠 받고 정렬을 고른다(2026-10-30 대표님).
--
-- v1(admin_search_applications)은 그대로 둔다. 다른 화면 · 배포 전 코드가 부를 수 있다.
-- v1 과 다른 점:
--   p_name    참여자 누구든(대표만이 아니라) 이름 · 입금자명에 들어 있으면
--   p_phone   참여자 누구든 전화번호 숫자에 들어 있으면(4자리 이상)
--   p_theme_id  테마(파티 · 노말 모드가 각각 테마다)
--   p_date_from / p_date_to  회차 날짜(KST) 범위 — v1 의 p_from/p_to 는 신청 시각이었다
--   p_time    회차 시작 시각(KST, 'HH:MM')
--   p_sort    created_desc(기본) · created_asc · session_asc · session_desc · name_asc
--   반환에 theme_mode(모드 이름) 를 더한다 — 두 모드의 테마명이 같아 목록에서 구분이 안 됐다.

create or replace function public.admin_search_applications_v2(
  p_query text,
  p_name text,
  p_phone text,
  p_session_id uuid,
  p_theme_id uuid,
  p_status text,
  p_payment text,
  p_date_from date,
  p_date_to date,
  p_time text,
  p_sort text,
  p_limit integer,
  p_offset integer
)
returns table(
  id uuid, confirmation_code text, status text, payment_status text, headcount integer,
  amount_krw integer, discount_krw integer, coupons text, created_at timestamptz,
  session_id uuid, session_start_at timestamptz, theme_name text, theme_mode text, format_label text,
  representative_name text, representative_phone text, depositor_name text, total_count bigint
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_time text := nullif(btrim(coalesce(p_time, '')), '');
begin
  return query
  with base as (
    select
      ap.id, ap.confirmation_code, ap.status, ap.payment_status,
      coalesce(ap.headcount, (select count(*)::int from application_attendees x
                              where x.application_id = ap.id)) as headcount,
      coalesce(ap.amount_krw,
               s.price_krw * (select count(*)::int from application_attendees x
                              where x.application_id = ap.id)) as amount_krw,
      coalesce(ap.discount_krw, 0) as discount_krw,
      (select string_agg(ac.campaign_name || ' ' || ac.code, ', ' order by ac.code)
         from application_coupons ac where ac.application_id = ap.id) as coupons,
      ap.created_at,
      s.id as session_id, s.start_at as session_start_at,
      coalesce(t.name, s.theme_name) as theme_name,
      t.variant_label as theme_mode,
      coalesce(s.legacy_format, s.session_type) as format_label,
      decrypt_pii(rep.name_enc)  as representative_name,
      decrypt_pii(rep.phone_enc) as representative_phone,
      decrypt_pii(ap.depositor_name_enc) as depositor_name
    from applications ap
    join sessions s on s.id = ap.session_id
    left join themes t on t.id = s.theme_id
    left join lateral (
      select aa.name_enc, aa.phone_enc
      from application_attendees aa
      where aa.application_id = ap.id
      order by aa.is_representative desc
      limit 1
    ) rep on true
    where (p_session_id is null or ap.session_id = p_session_id)
      and (p_theme_id   is null or s.theme_id = p_theme_id)
      and (p_status     is null or ap.status = p_status)
      and (p_payment    is null or ap.payment_status = p_payment)
      and (p_date_from  is null or (s.start_at at time zone 'Asia/Seoul')::date >= p_date_from)
      and (p_date_to    is null or (s.start_at at time zone 'Asia/Seoul')::date <= p_date_to)
      and (v_time       is null or to_char(s.start_at at time zone 'Asia/Seoul', 'HH24:MI') = v_time)
  ),
  filtered as (
    select * from base b
    where (v_q is null
           or b.confirmation_code = v_q
           or b.representative_name ilike '%' || v_q || '%'
           or b.depositor_name      ilike '%' || v_q || '%'
           or (length(v_digits) >= 4 and regexp_replace(b.representative_phone, '[^0-9]', '', 'g') like '%' || v_digits || '%'))
      and (v_name is null
           or b.depositor_name ilike '%' || v_name || '%'
           or exists (select 1 from application_attendees x
                      where x.application_id = b.id and decrypt_pii(x.name_enc) ilike '%' || v_name || '%'))
      and (length(v_phone) < 4
           or exists (select 1 from application_attendees x
                      where x.application_id = b.id
                        and regexp_replace(decrypt_pii(x.phone_enc), '[^0-9]', '', 'g') like '%' || v_phone || '%'))
  ),
  counted as (select count(*) as n from filtered)
  select f.id, f.confirmation_code, f.status, f.payment_status, f.headcount, f.amount_krw,
         f.discount_krw, f.coupons,
         f.created_at, f.session_id, f.session_start_at, f.theme_name, f.theme_mode, f.format_label,
         f.representative_name, f.representative_phone, f.depositor_name,
         c.n
  from filtered f, counted c
  order by
    case when p_sort = 'created_asc'  then f.created_at end asc,
    case when p_sort = 'session_asc'  then f.session_start_at end asc,
    case when p_sort = 'session_desc' then f.session_start_at end desc,
    case when p_sort = 'name_asc'     then f.representative_name end asc,
    f.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$function$;

-- v1 과 같은 권한 — 어드민 서버(service_role)만 부른다.
revoke all on function public.admin_search_applications_v2(
  text, text, text, uuid, uuid, text, text, date, date, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.admin_search_applications_v2(
  text, text, text, uuid, uuid, text, text, date, date, text, text, integer, integer
) to service_role;
