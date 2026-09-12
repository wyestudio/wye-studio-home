-- submit_application_v2 — 쿠폰 적용 버전 (파라미터 10개)
--
-- 적용: 운영 적용 완료 (2026-09-12) / test 는 이미 있었다
--       적용 후 pg_get_functiondef md5 가 test 와 일치함을 확인:
--       ed7d17f995b52d83ee9f838683b3ba01
--
-- ⚠️ 이것 때문에 운영에서 **신청이 전혀 되지 않았다.**
--    앱(src/app/(site)/themes/[slug]/apply/actions.ts)은 항상 p_coupon_code 를
--    포함한 10개 파라미터로 호출하는데, 운영에는 9개짜리(쿠폰 이전 버전)만
--    있어서 PostgREST 가 함수를 찾지 못했다:
--      Could not find the function public.submit_application_v2(..., p_coupon_code, ...)
--      in the schema cache
--    쿠폰 스키마(p13)를 test 에서 떠올 때 이 함수와 applications 의 쿠폰 컬럼
--    (p17)을 같이 가져오지 않은 것이 원인이다.
--
-- ⚠️ 9개짜리 옛 시그니처는 **지우지 않고 남겨 둔다.** 호출하는 코드는 없지만
--    (grep 결과 submit_application_v2 호출부는 신규 신청폼 한 곳뿐이고 항상
--     10개를 넘긴다) 2026-08-14 의 함수 오삭제 장애 이력을 고려해 남긴다.
--    원본은 _backup/submit_application_v2_9params_pre_coupon.sql 에도 있다.
--
-- 되돌리기: 위 _backup 파일의 9개짜리 정의로 되돌리고 이 10개짜리를 drop 한다.
--   drop function if exists public.submit_application_v2(
--     uuid,text,boolean,boolean,jsonb,text,boolean,boolean,uuid,text);

CREATE OR REPLACE FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_session record; v_group_size int; v_current_total int; v_status text;
  v_code text; v_app applications%rowtype; v_unit_price int;
  v_base_amount int; v_amount int; v_dup_phones text; v_self_dup text;
  v_waiting_number int; v_coupon coupons%rowtype; v_preview jsonb;
  v_discount int := 0; v_coupon_id uuid := null; v_rep_phone text;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  perform 1 from sessions where id = p_session_id for update;

  select sv.*, t.max_group_size, t.is_active as theme_active into v_session
  from session_view sv join themes t on t.id = sv.theme_id where sv.id = p_session_id;

  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if not v_session.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then raise exception '참여 인원을 입력해주세요.'; end if;
  if v_session.max_group_size is not null and v_group_size > v_session.max_group_size then
    raise exception '한 번에 최대 %명까지 신청할 수 있습니다.', v_session.max_group_size; end if;

  if exists (select 1 from jsonb_array_elements(p_attendees) a
             where not is_eligible_birth_year((a->>'birth_year')::int, v_session.min_age)) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_session.min_age; end if;

  select string_agg(distinct phone, ',') into v_self_dup from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a group by 1 having count(*) > 1) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.' using detail = v_self_dup; end if;

  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',') into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (select 1 from application_attendees aa
                join applications ap on ap.id = aa.application_id
                join sessions s on s.id = ap.session_id
                where ap.status <> 'cancelled' and aa.phone_hash = hash_phone(a->>'phone')
                  and s.theme_id = v_session.theme_id);
  if v_dup_phones is not null then
    raise exception '이미 이 테마에 신청하신 분이 포함되어 있어요. 같은 테마는 한 번만 참여할 수 있습니다.' using detail = v_dup_phones; end if;

  select coalesce(sum(cnt), 0) into v_current_total from (
    select ap.id, count(*) as cnt from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed','waiting') group by ap.id) t;

  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원마감: 남은 자리가 부족합니다.'; end if;

  v_status := case when v_current_total + v_group_size <= v_session.capacity_confirm_line
                   then 'confirmed' else 'waiting' end;

  v_unit_price := coalesce(v_session.price_krw_override, resolve_unit_price(v_session.theme_id, v_group_size));
  if v_unit_price is null then raise exception '이 테마의 요금이 설정되지 않았습니다. 운영자에게 문의해주세요.'; end if;
  v_base_amount := v_unit_price * v_group_size;
  v_amount := v_base_amount;

  if normalize_coupon_code(p_coupon_code) is not null
     and normalize_coupon_code(p_coupon_code) <> '' then
    -- 먼저 잠근다. preview 검사만 믿으면 동시 신청에 같은 코드가 두 번 먹는다.
    select * into v_coupon from coupons
     where code = normalize_coupon_code(p_coupon_code) for update;
    if not found then raise exception '존재하지 않는 쿠폰 코드예요.'; end if;
    if v_coupon.used_at is not null then raise exception '이미 사용된 쿠폰이에요.'; end if;

    v_rep_phone := regexp_replace(p_attendees->0->>'phone', '[^0-9]', '', 'g');
    v_preview := preview_coupon(p_coupon_code, v_session.theme_id, v_group_size, v_base_amount, v_rep_phone);
    if not (v_preview->>'ok')::boolean then raise exception '%', v_preview->>'reason'; end if;

    v_discount := (v_preview->>'discount_krw')::int;
    v_amount := (v_preview->>'final_amount_krw')::int;
    v_coupon_id := v_coupon.id;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (
    session_id, user_id, depositor_name_enc, depositor_name_hash,
    consent_required, consent_optional, consent_photo, consent_marketing,
    confirmation_code, status, notes, headcount, unit_price_krw, amount_krw,
    coupon_id, discount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes, v_group_size, v_unit_price, v_amount,
    v_coupon_id, v_discount
  ) returning * into v_app;

  if v_coupon_id is not null then
    update coupons set used_at = now(), used_application_id = v_app.id where id = v_coupon_id;
  end if;

  insert into application_attendees (
    application_id, session_id, is_representative,
    name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range)
  select v_app.id, p_session_id, (ord = 1),
         encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
         (a->>'birth_year')::int, nullif(a->>'nickname',''),
         nullif(a->>'gender',''), nullif(a->>'experience_range','')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  if v_current_total + v_group_size >= v_session.capacity_max then
    update sessions set status = 'closed', updated_at = now() where id = p_session_id; end if;

  if v_app.status = 'waiting' then
    select count(*) + 1 into v_waiting_number from applications
     where session_id = p_session_id and status = 'waiting' and id <> v_app.id; end if;

  return jsonb_build_object(
    'id', v_app.id, 'confirmation_code', v_app.confirmation_code,
    'status', v_app.status, 'payment_status', v_app.payment_status,
    'headcount', v_group_size, 'unit_price_krw', v_unit_price,
    'base_amount_krw', v_base_amount, 'discount_krw', v_discount,
    'amount_krw', v_amount, 'waiting_number', v_waiting_number,
    'created_at', v_app.created_at);
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end; $function$;
