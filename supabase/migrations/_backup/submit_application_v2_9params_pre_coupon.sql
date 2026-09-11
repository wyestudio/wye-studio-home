-- 백업 — submit_application_v2 (9-파라미터, 쿠폰 도입 이전 버전)
--
-- 원본 md5: df902cd2b1eea2b48c76aab84c015274 (길이 6029)
-- 백업 시각: 2026-09-10
--
-- ── 왜 남기는가 ────────────────────────────────────────────────
--
-- 쿠폰을 붙이며 p_coupon_code 를 추가했더니 create or replace 가 덮어쓰지 않고
-- 10-파라미터 함수를 **새로** 만들었다. 두 개가 공존하면 앱의 8-인자 호출이
-- 양쪽 모두에 매칭돼 "function is not unique" 가 난다. 그래서 이 9-파라미터
-- 버전을 삭제했다.
--
-- 2026-08-14 에 같은 종류의 상황(파라미터 개수가 다른 동명 함수 2개)에서
-- 원본이 리포지토리에 없어 복구하지 못한 장애가 있었다. 그래서 지우기 전에
-- 정의를 그대로 파일로 남긴다.
--
-- 되돌리려면 이 파일을 실행한 뒤 10-파라미터 버전을 삭제할 것:
--   drop function submit_application_v2(uuid,text,boolean,boolean,jsonb,text,boolean,boolean,uuid,text);
--
-- ⚠️ 이 파일은 기록용이다. 평소에 실행하지 말 것.

CREATE OR REPLACE FUNCTION public.submit_application_v2(p_session_id uuid, p_depositor_name text, p_consent_required boolean, p_consent_optional boolean, p_attendees jsonb, p_notes text DEFAULT NULL::text, p_consent_photo boolean DEFAULT false, p_consent_marketing boolean DEFAULT false, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_session        record;
  v_group_size     int;
  v_current_total  int;
  v_status         text;
  v_code           text;
  v_app            applications%rowtype;
  v_unit_price     int;
  v_amount         int;
  v_dup_phones     text;
  v_self_dup       text;
  v_waiting_number int;
begin
  if not p_consent_required then
    raise exception '필수 약관에 동의해야 신청할 수 있습니다.';
  end if;

  -- 회차 잠금. 실효값(가격·정원)은 session_view 기준이지만 잠금은 원본 테이블에 건다.
  perform 1 from sessions where id = p_session_id for update;

  select sv.*, t.max_group_size, t.is_active as theme_active
    into v_session
  from session_view sv
  join themes t on t.id = sv.theme_id
  where sv.id = p_session_id;

  if not found then raise exception '존재하지 않는 회차입니다.'; end if;
  if not v_session.theme_active then raise exception '현재 신청을 받지 않는 테마입니다.'; end if;
  if v_session.status <> 'open' then raise exception '이미 마감된 회차입니다.'; end if;

  v_group_size := jsonb_array_length(p_attendees);
  if v_group_size is null or v_group_size < 1 then
    raise exception '참여 인원을 입력해주세요.';
  end if;

  if v_session.max_group_size is not null and v_group_size > v_session.max_group_size then
    raise exception '한 번에 최대 %명까지 신청할 수 있습니다.', v_session.max_group_size;
  end if;

  -- 나이: 회차의 min_age 기준. 출생연도만 받으므로 "확실한" 사람만 통과시킨다.
  if exists (
    select 1 from jsonb_array_elements(p_attendees) a
    where not is_eligible_birth_year((a->>'birth_year')::int, v_session.min_age)
  ) then
    raise exception '이 회차는 만 %세 이상만 참여할 수 있습니다.', v_session.min_age;
  end if;

  -- 그룹 내부 전화번호 중복
  select string_agg(distinct phone, ',') into v_self_dup
  from (
    select regexp_replace(a->>'phone', '[^0-9]', '', 'g') as phone
    from jsonb_array_elements(p_attendees) a
    group by 1 having count(*) > 1
  ) t;
  if v_self_dup is not null then
    raise exception '그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 번호를 입력해주세요.'
      using detail = v_self_dup;
  end if;

  -- 재참여 배타: 같은 테마에 취소되지 않은 신청이 이미 있으면 거부 (D-02)
  select string_agg(distinct regexp_replace(a->>'phone', '[^0-9]', '', 'g'), ',')
  into v_dup_phones
  from jsonb_array_elements(p_attendees) a
  where exists (
    select 1
    from application_attendees aa
    join applications ap on ap.id = aa.application_id
    join sessions s      on s.id  = ap.session_id
    where ap.status <> 'cancelled'
      and aa.phone_hash = hash_phone(a->>'phone')
      and s.theme_id = v_session.theme_id
  );
  if v_dup_phones is not null then
    raise exception '이미 이 테마에 신청하신 분이 포함되어 있어요. 같은 테마는 한 번만 참여할 수 있습니다.'
      using detail = v_dup_phones;
  end if;

  -- 정원 (인원 합계 기준). 성별 분기 없음.
  select coalesce(sum(cnt), 0) into v_current_total
  from (
    select ap.id, count(*) as cnt
    from applications ap
    join application_attendees aa on aa.application_id = ap.id
    where ap.session_id = p_session_id and ap.status in ('confirmed','waiting')
    group by ap.id
  ) t;

  -- 그룹 전체가 들어갈 자리가 없으면 신청 자체를 거부한다(부분 확정 없음).
  if v_current_total + v_group_size > v_session.capacity_max then
    raise exception '정원마감: 남은 자리가 부족합니다.';
  end if;

  v_status := case
    when v_current_total + v_group_size <= v_session.capacity_confirm_line then 'confirmed'
    else 'waiting'
  end;

  -- 가격: 인원수 구간에서 결정. 회차 단일가 override 가 있으면 그것이 우선.
  v_unit_price := coalesce(v_session.price_krw_override,
                           resolve_unit_price(v_session.theme_id, v_group_size));
  if v_unit_price is null then
    raise exception '이 테마의 요금이 설정되지 않았습니다. 운영자에게 문의해주세요.';
  end if;
  v_amount := v_unit_price * v_group_size;

  for i in 1..20 loop
    v_code := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from applications where confirmation_code = v_code);
  end loop;

  insert into applications (
    session_id, user_id, depositor_name_enc, depositor_name_hash,
    consent_required, consent_optional, consent_photo, consent_marketing,
    confirmation_code, status, notes,
    headcount, unit_price_krw, amount_krw
  ) values (
    p_session_id, p_user_id, encrypt_pii(p_depositor_name),
    hash_phone(normalize_depositor_name(p_depositor_name)),
    p_consent_required, p_consent_optional, p_consent_photo, p_consent_marketing,
    v_code, v_status, p_notes,
    v_group_size, v_unit_price, v_amount
  ) returning * into v_app;

  insert into application_attendees (
    application_id, session_id, is_representative,
    name_enc, phone_enc, phone_hash, birth_year, nickname, gender, experience_range
  )
  select v_app.id, p_session_id, (ord = 1),
         encrypt_pii(a->>'name'), encrypt_pii(a->>'phone'), hash_phone(a->>'phone'),
         (a->>'birth_year')::int, nullif(a->>'nickname',''),
         nullif(a->>'gender',''), nullif(a->>'experience_range','')
  from jsonb_array_elements(p_attendees) with ordinality as t(a, ord);

  if v_current_total + v_group_size >= v_session.capacity_max then
    update sessions set status = 'closed', updated_at = now() where id = p_session_id;
  end if;

  if v_app.status = 'waiting' then
    select count(*) + 1 into v_waiting_number
    from applications
    where session_id = p_session_id and status = 'waiting' and id <> v_app.id;
  end if;

  return jsonb_build_object(
    'id', v_app.id,
    'confirmation_code', v_app.confirmation_code,
    'status', v_app.status,
    'payment_status', v_app.payment_status,
    'headcount', v_group_size,
    'unit_price_krw', v_unit_price,
    'amount_krw', v_amount,
    'waiting_number', v_waiting_number,
    'created_at', v_app.created_at
  );
exception
  when unique_violation then
    raise exception '선택하신 닉네임 중 하나가 이미 사용 중이에요. 다른 닉네임을 입력해주세요.';
end;
$function$
