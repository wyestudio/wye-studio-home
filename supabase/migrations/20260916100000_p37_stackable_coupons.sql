-- p37: 쿠폰 중복 적용 (잼핏 + 인스타 이벤트는 겹치고, 프리오픈은 안 겹친다)
--
-- 왜
--   인스타 댓글 이벤트로 건당 5,000원 쿠폰을 뿌리는데, 잼핏에서 받은 쿠폰과
--   겹쳐 쓸 수 없으면 두 홍보가 서로를 깎아먹는다. 반대로 프리오픈 쿠폰(5,000원)은
--   이미 큰 할인이라 겹치면 안 된다.
--
-- 규칙
--   캠페인마다 `stackable` 을 둔다. **2장 이상 쓰려면 전부 stackable 이어야 한다.**
--   하나라도 아니면 그 한 장만 쓸 수 있다. 같은 캠페인 쿠폰 2장도 막는다.
--
-- ⚠️ submit_application_v2() 는 **손대지 않는다.** 복사해서 v3 를 새로 만든다.
--    2026-08-14 에 그 함수 시그니처를 잘못 건드려 서비스가 마비된 적이 있다.
--    신청은 우리 사업의 심장이라, 기능 추가 때문에 기존 경로를 흔들지 않는다.
--
-- ⚠️ 정산(잼핏 계약)이 지금까지 applications.coupon_id 로 "잼핏 쿠폰을 쓴 건" 을
--    찾았다. 중복이 되면 그 칸으로는 판정할 수 없다 — 아래 application_coupons
--    가 유일한 진실이 되고, 정산 코드도 같이 옮긴다.
--    (적용 시점 운영에 쿠폰 쓴 신청 0건 — 과거 데이터 이전 불필요)

-- ── 1) 중복 허용 플래그 ────────────────────────────────────────
alter table public.coupon_campaigns
  add column if not exists stackable boolean not null default false;

comment on column public.coupon_campaigns.stackable is
  '다른 쿠폰과 겹쳐 쓸 수 있는지. 2장 이상 적용하려면 전부 true 여야 한다.';

-- ── 2) 신청에 붙은 쿠폰들 ──────────────────────────────────────
create table if not exists public.application_coupons (
  application_id uuid not null references public.applications(id) on delete cascade,
  -- ⚠️ 쿠폰이 지워져도 정산 근거는 남아야 한다. 그래서 FK 는 set null 이고,
  --    코드·캠페인 이름·할인액을 **문자열로 같이 박아 둔다.**
  --    (옛 applications.coupon_id 는 on delete set null 이라 쿠폰을 지우면
  --     "이 신청이 무슨 쿠폰을 썼는지" 가 통째로 사라졌다)
  coupon_id      uuid references public.coupons(id) on delete set null,
  campaign_id    uuid references public.coupon_campaigns(id) on delete set null,
  code           text not null,
  campaign_name  text not null,
  discount_krw   integer not null check (discount_krw >= 0),
  created_at     timestamptz not null default now(),
  primary key (application_id, code)
);

create index if not exists application_coupons_campaign_idx
  on public.application_coupons (campaign_id);
create index if not exists application_coupons_coupon_idx
  on public.application_coupons (coupon_id);

comment on table public.application_coupons is
  '신청에 적용된 쿠폰들. 신청 1건에 여러 장이 붙을 수 있다(stackable 캠페인끼리만). 정산의 기준.';

alter table public.application_coupons enable row level security;
revoke all on public.application_coupons from anon, authenticated;
-- 신청은 SECURITY DEFINER 함수가 넣고, 정산은 service_role 이 읽는다.
grant select on public.application_coupons to service_role;

-- 옛 칸은 더 이상 쓰지 않는다. 지우지는 않는다(옛 신청 기록 보존).
comment on column public.applications.coupon_id is
  '[사용 안 함] 쿠폰 1장 시절의 칸. 지금은 application_coupons 가 진실이다. 옛 기록 보존용으로만 남긴다.';

-- ── 3) 여러 장 미리보기 ────────────────────────────────────────
--
-- ⚠️ 각 쿠폰은 **할인 전 정가**를 기준으로 계산하고 합산한다.
--    "앞 쿠폰을 뺀 금액에 다음 쿠폰" 방식이 아니다 — 지금 쓰는 쿠폰은 전부
--    정액/인당정액이라 결과가 같고, 순서에 따라 금액이 달라지지 않는 쪽이
--    고객에게 설명하기 쉽다. 정률 쿠폰을 겹치게 만들 일이 생기면 이 규칙을
--    다시 정해야 한다.
create or replace function public.preview_coupons(
  p_codes text[], p_theme_id uuid, p_headcount integer, p_base_amount integer,
  p_phone text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_code text; v_norm text;
  v_seen text[] := '{}';
  v_items jsonb := '[]'::jsonb;
  v_one jsonb;
  v_total int := 0;
  v_coupon coupons%rowtype;
  v_camp coupon_campaigns%rowtype;
  v_camps uuid[] := '{}';
  v_count int := 0;
  v_blocker text;
begin
  if p_codes is null or coalesce(array_length(p_codes, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  foreach v_code in array p_codes loop
    v_norm := normalize_coupon_code(v_code);
    continue when v_norm is null or v_norm = '';

    if v_norm = any(v_seen) then
      return jsonb_build_object('ok', false, 'reason', '같은 쿠폰을 두 번 넣을 수 없어요.');
    end if;
    v_seen := v_seen || v_norm;

    -- 낱장 판정은 기존 함수에 그대로 맡긴다. 규칙이 두 곳으로 갈라지면 안 된다.
    v_one := preview_coupon(v_norm, p_theme_id, p_headcount, p_base_amount, p_phone);
    if not (v_one->>'ok')::boolean then
      return jsonb_build_object('ok', false, 'reason', v_one->>'reason', 'code', v_norm);
    end if;

    select * into v_coupon from coupons where code = v_norm;
    select * into v_camp from coupon_campaigns where id = v_coupon.campaign_id;

    if v_camp.id = any(v_camps) then
      return jsonb_build_object(
        'ok', false,
        'reason', format('%s 쿠폰은 한 장만 쓸 수 있어요.', v_camp.name));
    end if;
    v_camps := v_camps || v_camp.id;

    v_count := v_count + 1;
    v_total := v_total + (v_one->>'discount_krw')::int;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code', v_norm,
      'campaign_id', v_camp.id,
      'campaign_name', v_camp.name,
      'stackable', v_camp.stackable,
      'discount_krw', (v_one->>'discount_krw')::int
    ));
  end loop;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  -- 2장 이상이면 전부 중복 허용이어야 한다. 아니면 어느 쿠폰이 문제인지 알려준다.
  if v_count > 1 then
    select e->>'campaign_name' into v_blocker
      from jsonb_array_elements(v_items) e
     where not (e->>'stackable')::boolean
     limit 1;
    if v_blocker is not null then
      return jsonb_build_object(
        'ok', false,
        'reason', format('%s 쿠폰은 다른 쿠폰과 함께 쓸 수 없어요.', v_blocker));
    end if;
  end if;

  v_total := least(v_total, p_base_amount);

  return jsonb_build_object(
    'ok', true,
    'items', v_items,
    'discount_krw', v_total,
    'final_amount_krw', p_base_amount - v_total
  );
end;
$function$;

-- ── 4) 신청 제출 v3 (쿠폰 여러 장) ─────────────────────────────
--
-- ⚠️ v2 를 복사해 **쿠폰 부분만** 바꿨다. 정원·연령·중복번호·대기 판정 등
--    나머지 로직은 v2 와 글자 그대로 같아야 한다. v2 는 그대로 살려둔다.
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

-- ── 5) 취소 시 쿠폰 반환 (여러 장) ─────────────────────────────
--
-- ⚠️ 새 표(application_coupons)와 옛 칸(applications.coupon_id) **둘 다** 푼다.
--    옛 신청이 남아 있을 수 있고, 어느 쪽이든 고객은 쿠폰을 잃으면 안 된다.
create or replace function public.release_coupon_on_cancel()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, '') <> 'cancelled' then
    -- 새 구조: 이 신청에 붙은 쿠폰 전부
    update coupons c
       set used_at = null, used_application_id = null
      from application_coupons ac
     where ac.application_id = new.id
       and c.id = ac.coupon_id
       and c.used_application_id = new.id;  -- 다른 신청이 쓰고 있으면 건드리지 않는다

    -- 옛 구조: 쿠폰 1장 시절 기록
    if new.coupon_id is not null then
      update coupons set used_at = null, used_application_id = null
       where id = new.coupon_id and used_application_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.release_coupon_on_cancel() is
  '신청이 취소되면 붙어 있던 쿠폰을 전부 미사용으로 되돌린다. 취소 경로가 여러 개라 트리거로 둔다.';
