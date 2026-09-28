-- ── 신청 제출 v3 — 중복 체크만 헬퍼 호출로 교체 ────────────────
--
-- ⚠️ 운영에 올라가 있는 정의(md5 15eafa5863b7c7e397bfb1bee250753b)를 그대로 가져와
--    **재참여 중복 체크 블록만** 바꿨다. 쿠폰·정원·연령·대기 판정 등 나머지는
--    글자 그대로 같아야 한다.
create or replace function public.submit_application_v3(
  p_session_id uuid, p_depositor_name text, p_consent_required boolean,
  p_consent_optional boolean, p_attendees jsonb, p_notes text default null::text,
  p_consent_photo boolean default false, p_consent_marketing boolean default false,
  p_user_id uuid default null::uuid, p_coupon_codes text[] default null::text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_session record; v_group_size int; v_current_total int; v_status text;
  v_code text; v_app applications%rowtype; v_unit_price int;
  v_base_amount int; v_amount int; v_dup_phones text; v_self_dup text;
  v_waiting_number int; v_preview jsonb; v_item jsonb;
  v_discount int := 0; v_rep_phone text; v_norm text; v_codes text[] := '{}';
  v_locked coupons%rowtype;
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

  -- 재참여 차단. 판정은 is_theme_participation_blocked() 한 곳에만 둔다 —
  -- 화면 사전 안내(check_active_applications_v2)와 같은 함수를 쓴다.
  -- 사람 단위 예외는 reparticipation_allowances 표에 적는다.
  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',') into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where is_theme_participation_blocked(a->>'phone', v_session.theme_id);
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

  -- ── 쿠폰 (v2 와 다른 부분) ──────────────────────────────────
  if p_coupon_codes is not null then
    -- 빈 값을 걸러 정규화한다.
    foreach v_norm in array p_coupon_codes loop
      v_norm := normalize_coupon_code(v_norm);
      if v_norm is not null and v_norm <> '' and not (v_norm = any(v_codes)) then
        v_codes := v_codes || v_norm;
      end if;
    end loop;
  end if;

  if coalesce(array_length(v_codes, 1), 0) > 0 then
    -- ⚠️ 먼저 **코드 순서대로** 잠근다. 순서를 고정해야 두 신청이 같은 두 장을
    --    반대 순서로 잡아 교착(deadlock)에 빠지지 않는다.
    --    preview 검사만 믿으면 동시 신청에 같은 코드가 두 번 먹는다.
    for v_norm in select unnest(v_codes) order by 1 loop
      select * into v_locked from coupons where code = v_norm for update;
      if not found then raise exception '존재하지 않는 쿠폰 코드예요.'; end if;
      if v_locked.used_at is not null then raise exception '이미 사용된 쿠폰이에요.'; end if;
    end loop;

    v_rep_phone := regexp_replace(p_attendees->0->>'phone', '[^0-9]', '', 'g');
    v_preview := preview_coupons(v_codes, v_session.theme_id, v_group_size, v_base_amount, v_rep_phone);
    if not (v_preview->>'ok')::boolean then raise exception '%', v_preview->>'reason'; end if;

    v_discount := (v_preview->>'discount_krw')::int;
    v_amount := (v_preview->>'final_amount_krw')::int;
  end if;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (
    session_id, user_id, depositor_name_enc, depositor_name_hash,
    consent_required, consent_optional, consent_photo, consent_marketing,
    confirmation_code, status, notes, headcount, unit_price_krw, amount_krw,
    discount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes, v_group_size, v_unit_price, v_amount,
    v_discount
  ) returning * into v_app;

  -- 쿠폰을 신청에 붙이고 소진 처리한다.
  if v_preview is not null and (v_preview->>'ok')::boolean then
    for v_item in select * from jsonb_array_elements(v_preview->'items') loop
      insert into application_coupons (
        application_id, coupon_id, campaign_id, code, campaign_name, discount_krw)
      select v_app.id, c.id, (v_item->>'campaign_id')::uuid,
             v_item->>'code', v_item->>'campaign_name', (v_item->>'discount_krw')::int
        from coupons c where c.code = v_item->>'code';

      update coupons set used_at = now(), used_application_id = v_app.id
       where code = v_item->>'code';
    end loop;
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
    'coupons', coalesce(v_preview->'items', '[]'::jsonb),
    'created_at', v_app.created_at);
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end; $function$;

revoke execute on function public.submit_application_v3(uuid, text, boolean, boolean, jsonb, text, boolean, boolean, uuid, text[]) from public;
grant execute on function public.submit_application_v3(uuid, text, boolean, boolean, jsonb, text, boolean, boolean, uuid, text[]) to anon, authenticated, service_role;
