-- p40: 어드민 신청 목록에 할인액·쿠폰 표시
--
-- ⚠️ 번호가 p40 인 이유: 처음 p38 로 만들었는데 같은 날 다른 작업의
--    p38_theme_intro_notice 와 번호·타임스탬프가 모두 겹쳤다.
--    오늘만 세 번째다(p31·p34·p38). 같은 저장소에서 두 작업이 동시에 돌 때는
--    새 번호를 정하기 전에 반드시 `ls supabase/migrations/` 로 확인할 것.
--
-- 왜
--   쿠폰 중복 적용(p37)이 되면서 같은 회차인데 결제액이 제각각이 됐다.
--   목록에는 최종 금액만 보여서 "이 사람은 왜 62,000원이지?" 를 알 수 없었다.
--
-- ⚠️ 반환 타입이 바뀌므로 create or replace 로는 안 된다. drop 후 다시 만든다.
--    같은 마이그레이션(=한 트랜잭션) 안에서 처리하므로 함수가 없는 순간은 없다.
--    ⚠️ 나머지 로직은 기존과 **글자 그대로** 같아야 한다 — 검색·필터·페이징은
--       손대지 않았다. 추가한 것은 select 목록의 discount_krw·coupons 두 칸뿐이다.

drop function if exists public.admin_search_applications(text, uuid, text, text, timestamptz, timestamptz, int, int);

create function public.admin_search_applications(
  p_query text, p_session_id uuid, p_status text, p_payment text,
  p_from timestamptz, p_to timestamptz, p_limit int, p_offset int)
returns table(
  id uuid, confirmation_code text, status text, payment_status text,
  headcount integer, amount_krw integer,
  discount_krw integer, coupons text,
  created_at timestamptz, session_id uuid, session_start_at timestamptz,
  theme_name text, format_label text,
  representative_name text, representative_phone text, depositor_name text,
  total_count bigint)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := regexp_replace(coalesce(p_query,''), '[^0-9]', '', 'g');
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
      -- 붙은 쿠폰들. 이름과 코드를 같이 보여야 어느 이벤트 건인지 바로 안다.
      -- ⚠️ application_coupons 를 본다. applications.coupon_id 는 쿠폰 1장 시절 칸이라
      --    중복 적용 건을 놓친다(p37).
      (select string_agg(ac.campaign_name || ' ' || ac.code, ', ' order by ac.code)
         from application_coupons ac where ac.application_id = ap.id) as coupons,
      ap.created_at,
      s.id as session_id, s.start_at as session_start_at,
      coalesce(t.name, s.theme_name) as theme_name,
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
      and (p_status  is null or ap.status = p_status)
      and (p_payment is null or ap.payment_status = p_payment)
      and (p_from    is null or ap.created_at >= p_from)
      and (p_to      is null or ap.created_at <= p_to)
  ),
  filtered as (
    select * from base b
    where v_q is null
       or b.confirmation_code = v_q
       or b.representative_name ilike '%' || v_q || '%'
       or b.depositor_name      ilike '%' || v_q || '%'
       or (length(v_digits) >= 4 and regexp_replace(b.representative_phone, '[^0-9]', '', 'g') like '%' || v_digits || '%')
  ),
  counted as (select count(*) as n from filtered)
  select f.id, f.confirmation_code, f.status, f.payment_status, f.headcount, f.amount_krw,
         f.discount_krw, f.coupons,
         f.created_at, f.session_id, f.session_start_at, f.theme_name, f.format_label,
         f.representative_name, f.representative_phone, f.depositor_name,
         c.n
  from filtered f, counted c
  order by f.created_at desc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
end;
$function$;

revoke execute on function public.admin_search_applications(text, uuid, text, text, timestamptz, timestamptz, int, int) from public, anon, authenticated;
grant execute on function public.admin_search_applications(text, uuid, text, text, timestamptz, timestamptz, int, int) to service_role;
