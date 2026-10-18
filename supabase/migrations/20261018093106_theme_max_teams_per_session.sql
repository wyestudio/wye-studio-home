-- 회차당 최대 팀(신청 건) 수 — 노말모드는 한 회차에 한 팀만 받는다
--
-- 적용: test 20261018093244 (2026-10-18) / 운영 적용 (2026-10-18, 이력 기록함)
--
-- 왜
--   노말모드는 한 팀이 회차 전체를 쓰는 단독 진행이다(2026-10-18 대표님). 그런데 정원은
--   파티와 같은 칸(capacity_max 40)을 쓰고 있어서, 2인 팀이 예약해도 남은 자리로 다른 팀이
--   또 예약할 수 있었다. 인원 정원으로는 막을 수 없다(2인 팀 뒤에 4명이 더 들어온다).
--   그래서 사람 수가 아니라 **신청 건수**로 세는 칸을 따로 둔다.
--
--   재참여 제한(reparticipation_limit)이 비어 있는 것으로 노말을 알아보던 기존 판정과
--   섞지 않는다 — "몇 번이든 다시 와도 된다" 와 "한 회차에 한 팀" 은 다른 규칙이다.
--
-- 동시성
--   submit_application_v3 는 맨 처음에 회차 행을 for update 로 잠근다. 같은 회차에 동시에
--   들어온 두 예약은 그 줄에서 줄을 서고, 뒤에 온 쪽은 앞의 것이 커밋된 뒤에 건수를 다시
--   센다(read committed — 문장마다 새로 본다). 그래서 둘 다 통과할 수 없다.
--
-- 바꾼 곳 (submit_application_v3 — 운영·테스트 정의가 같음을 md5 로 확인한 뒤 그 텍스트에서)
--   1. 회차를 읽을 때 t.max_teams_per_session 을 같이 읽는다
--   2. 시작 시각 검사 바로 뒤 — 이미 찬 회차면 '정원마감:' 으로 거절한다
--   3. 신청을 넣은 뒤 — 팀 수가 찼으면 회차를 closed 로 내린다(화면에 '마감' 으로 보이게)
--   나머지는 한 글자도 바꾸지 않았다.
--
-- ⚠️ 취소돼도 회차를 자동으로 다시 열지 않는다 — 파티 정원마감과 같다. 운영자가 어드민에서
--    연다. 열어 둔 회차에 아직 살아 있는 예약이 있으면 2번 검사가 다시 막는다.
-- ⚠️ 어드민 수동 등록도 이 함수를 지난다 — 한 팀이 있는 노말 회차에는 어드민도 못 넣는다.

alter table public.themes
  add column if not exists max_teams_per_session integer
    check (max_teams_per_session is null or max_teams_per_session >= 1);

comment on column public.themes.max_teams_per_session is
  '회차당 최대 신청 건(팀) 수. null 이면 제한 없음(정원까지 계속 받음). 노말모드 = 1.';

update public.themes set max_teams_per_session = 1 where slug = 'baotalchul-normal';

CREATE OR REPLACE FUNCTION public.submit_application_v3(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid, p_coupon_codes text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_session record; v_group_size int; v_current_total int; v_status text;
  v_code text; v_app applications%rowtype; v_unit_price int;
  v_base_amount int; v_amount int; v_dup_phones text; v_self_dup text;
  v_waiting_number int; v_preview jsonb; v_item jsonb;
  v_discount int := 0; v_rep_phone text; v_norm text; v_codes text[] := '{}';
  v_locked coupons%rowtype;
  -- ── 프로모션 (v3 이전과 다른 부분) ──
  v_base_unit_price int; v_promo_discount int := 0;
  v_promo_id uuid; v_promo_name text; v_promo_unit int;
begin
  if not p_consent_required then raise exception '필수 약관에 동의해야 신청할 수 있습니다.'; end if;
  perform 1 from sessions where id = p_session_id for update;

  select sv.*, t.max_group_size, t.is_active as theme_active, t.max_teams_per_session into v_session
  from session_view sv join themes t on t.id = sv.theme_id where sv.id = p_session_id;

  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if not v_session.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;
  -- 이미 시작한 회차는 받지 않는다. status 는 손으로 내리는 값이라 지나간 회차에도
  -- 'open' 이 남는다 — 시각으로 끊지 않으면 끝난 회차에 신청이 들어간다.
  if v_session.start_at < now() then raise exception '이미 마감된 회차입니다.'; end if;
  -- 회차당 팀 수 제한(노말모드 = 1팀). 위에서 회차 행을 잠갔으므로 동시 예약도 여기서 차례로 걸린다.
  if v_session.max_teams_per_session is not null
     and (select count(*) from applications
           where session_id = p_session_id and status in ('confirmed','waiting')) >= v_session.max_teams_per_session then
    raise exception '정원마감: 이미 다른 팀이 예약한 회차예요. 다른 시간을 선택해주세요.'; end if;

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

  -- ── 인당가 (프로모션 적용) ─────────────────────────────────
  v_base_unit_price := coalesce(v_session.price_krw_override, resolve_unit_price(v_session.theme_id, v_group_size));
  if v_base_unit_price is null then raise exception '이 테마의 요금이 설정되지 않았습니다. 운영자에게 문의해주세요.'; end if;
  v_unit_price := v_base_unit_price;

  -- 회차별 금액을 손으로 박아 둔 회차는 프로모션보다 그쪽이 이긴다.
  if v_session.price_krw_override is null then
    select r.promotion_id, r.promotion_name, r.unit_price_krw
      into v_promo_id, v_promo_name, v_promo_unit
      from resolve_promotion_price(v_session.theme_id, v_session.start_at, v_group_size, now()) r;

    -- 프로모션가가 기본가보다 싸지 않으면 적용하지 않는다. 운영자가 숫자를
    -- 잘못 넣어도 고객이 기본가보다 더 내는 일은 없어야 한다.
    if v_promo_unit is not null and v_promo_unit < v_base_unit_price then
      v_unit_price := v_promo_unit;
      v_promo_discount := (v_base_unit_price - v_unit_price) * v_group_size;
    else
      v_promo_id := null; v_promo_name := null;
    end if;
  end if;

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
    -- ⚠️ 쿠폰은 **프로모션이 적용된 금액 위에** 얹힌다(중복 적용 가능).
    --    정률 쿠폰도 할인 후 금액을 기준으로 계산된다.
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
    discount_krw,
    promotion_id, promotion_name, base_unit_price_krw, promotion_discount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes, v_group_size, v_unit_price, v_amount,
    v_discount,
    v_promo_id, v_promo_name, v_base_unit_price, v_promo_discount
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
  -- 팀 수가 찼으면 회차를 내린다 — 화면이 status 로 '마감' 을 그린다.
  if v_session.max_teams_per_session is not null
     and (select count(*) from applications
           where session_id = p_session_id and status in ('confirmed','waiting')) >= v_session.max_teams_per_session then
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
    'promotion_id', v_promo_id,
    'promotion_name', v_promo_name,
    'base_unit_price_krw', v_base_unit_price,
    'promotion_discount_krw', v_promo_discount,
    'created_at', v_app.created_at);
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end; $function$;
