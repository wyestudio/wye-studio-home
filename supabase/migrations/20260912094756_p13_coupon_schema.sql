-- Phase 13 — 쿠폰 스키마를 마이그레이션으로 되돌려 놓는다.
--
-- 적용: test (이미 존재 · 이 파일은 test 의 실제 정의를 그대로 옮긴 것)
--       운영 적용 완료 (2026-09-12)
-- 되돌리기:
--   drop function if exists coupon_recipients(uuid, boolean);
--   drop function if exists assign_coupon(uuid, text);
--   drop function if exists preview_coupon(text, uuid, integer, integer, text);
--   drop function if exists lookup_attendee_by_phone_hash(text);
--   drop function if exists normalize_coupon_code(text);
--   drop table if exists coupons;
--   drop table if exists coupon_campaigns;
--
-- ⚠️ 왜 이 파일이 뒤늦게 생겼나
--    쿠폰 테이블·함수가 마이그레이션을 거치지 않고 SQL Editor 에서 직접
--    만들어져 있었다. test 에만 존재했고 리포지토리에도 schema.sql 에도 없었다.
--    운영 반영 준비 중에 발견해, test 의 실제 정의(pg_get_functiondef /
--    pg_get_constraintdef)를 그대로 떠서 파일로 남긴다.
--
-- ⚠️ 함수 권한을 반드시 명시한다. Postgres 는 proacl 이 NULL 이면 기본값이
--    PUBLIC 실행 허용이다 (README 의 v44 사고 참고).
--    · normalize_coupon_code : anon 도 호출 (신청 폼이 코드 정규화에 쓴다)
--    · preview_coupon        : anon 도 호출 (신청 폼의 쿠폰 미리보기)
--    · assign_coupon / coupon_recipients / lookup_attendee_by_phone_hash
--      : service_role 만 — 어드민 서버 액션 전용. 개인정보를 복호화해 돌려준다.

create table if not exists coupon_campaigns (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  description              text,
  discount_type            text not null check (discount_type in ('fixed','percent')),
  discount_value           int  not null check (discount_value > 0),
  max_discount_krw         int  check (max_discount_krw is null or max_discount_krw > 0),
  min_headcount            int  check (min_headcount is null or min_headcount > 0),
  theme_id                 uuid references themes(id) on delete set null,
  valid_from               timestamptz,
  valid_until              timestamptz,
  restrict_to_issued_phone boolean not null default false,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint percent_range check (
    discount_type <> 'percent' or (discount_value >= 1 and discount_value <= 100))
);

create table if not exists coupons (
  id                   uuid primary key default gen_random_uuid(),
  campaign_id          uuid not null references coupon_campaigns(id) on delete cascade,
  code                 text not null unique,
  issued_to_phone_hash text,
  issued_label         text,
  used_at              timestamptz,
  used_application_id  uuid references applications(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists coupons_campaign_idx     on coupons (campaign_id);
create index if not exists coupons_issued_phone_idx on coupons (issued_to_phone_hash);
create index if not exists coupons_unused_idx       on coupons (code) where used_at is null;

-- 쿠폰은 RPC 로만 다룬다. 테이블 직접 접근은 anon 에 열지 않는다.
alter table coupon_campaigns enable row level security;
alter table coupons          enable row level security;

revoke all on coupon_campaigns, coupons from anon, authenticated;
grant select, insert, update, delete on coupon_campaigns, coupons to service_role;

create or replace function public.normalize_coupon_code(p_raw text)
returns text language sql immutable set search_path to 'public'
as $function$
  select case
    when p_raw is null then null
    else translate(
           regexp_replace(upper(btrim(p_raw)), '[^0-9A-Z]', '', 'g'),
           'ILOU', '110V'
         )
  end;
$function$;

revoke execute on function public.normalize_coupon_code(text) from public;
grant execute on function public.normalize_coupon_code(text) to anon, authenticated, service_role;

create or replace function public.lookup_attendee_by_phone_hash(p_phone_hash text)
returns table(name text, phone text)
language sql security definer set search_path to 'public', 'extensions'
as $function$
  select decrypt_pii(aa.name_enc), decrypt_pii(aa.phone_enc)
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where aa.phone_hash = p_phone_hash
    and ap.status <> 'cancelled'
  order by aa.created_at desc
  limit 1;
$function$;

revoke execute on function public.lookup_attendee_by_phone_hash(text) from public;
grant execute on function public.lookup_attendee_by_phone_hash(text) to service_role;

create or replace function public.coupon_recipients(p_session_id uuid, p_paid_only boolean default true)
returns table(phone_hash text, name text, phone text, is_representative boolean, confirmation_code text)
language sql security definer set search_path to 'public', 'extensions'
as $function$
  select distinct on (aa.phone_hash)
    aa.phone_hash,
    decrypt_pii(aa.name_enc)  as name,
    decrypt_pii(aa.phone_enc) as phone,
    aa.is_representative,
    ap.confirmation_code
  from application_attendees aa
  join applications ap on ap.id = aa.application_id
  where ap.session_id = p_session_id
    and ap.status <> 'cancelled'
    and (not p_paid_only or (ap.status = 'confirmed' and ap.payment_status = 'confirmed'))
  order by aa.phone_hash, aa.is_representative desc;
$function$;

revoke execute on function public.coupon_recipients(uuid, boolean) from public;
grant execute on function public.coupon_recipients(uuid, boolean) to service_role;

create or replace function public.assign_coupon(p_campaign_id uuid, p_phone_hash text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_coupon coupons%rowtype;
begin
  -- 이미 배정된 게 있으면 재사용한다.
  select * into v_coupon
  from coupons
  where campaign_id = p_campaign_id
    and issued_to_phone_hash = p_phone_hash
  limit 1;

  if found then
    return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', true);
  end if;

  -- 아직 아무에게도 안 준 미사용 쿠폰 하나를 잠그고 가져온다.
  select * into v_coupon
  from coupons
  where campaign_id = p_campaign_id
    and issued_to_phone_hash is null
    and used_at is null
  order by code
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('ok', false, 'reason', '남은 쿠폰이 없습니다.');
  end if;

  update coupons
     set issued_to_phone_hash = p_phone_hash
   where id = v_coupon.id;

  return jsonb_build_object('ok', true, 'code', v_coupon.code, 'reused', false);
end;
$function$;

revoke execute on function public.assign_coupon(uuid, text) from public;
grant execute on function public.assign_coupon(uuid, text) to service_role;

create or replace function public.preview_coupon(
  p_code text, p_theme_id uuid, p_headcount integer, p_base_amount integer,
  p_phone text default null::text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_coupon   coupons%rowtype;
  v_camp     coupon_campaigns%rowtype;
  v_discount int;
  v_norm     text;
begin
  v_norm := normalize_coupon_code(p_code);
  if v_norm is null or v_norm = '' then
    return jsonb_build_object('ok', false, 'reason', '쿠폰 코드를 입력해주세요.');
  end if;

  select * into v_coupon from coupons where code = v_norm;
  if not found then
    return jsonb_build_object('ok', false, 'reason', '존재하지 않는 쿠폰 코드예요.');
  end if;

  if v_coupon.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', '이미 사용된 쿠폰이에요.');
  end if;

  select * into v_camp from coupon_campaigns where id = v_coupon.campaign_id;

  if not v_camp.is_active then
    return jsonb_build_object('ok', false, 'reason', '지금은 사용할 수 없는 쿠폰이에요.');
  end if;
  if v_camp.valid_from is not null and now() < v_camp.valid_from then
    return jsonb_build_object('ok', false, 'reason', '아직 사용 기간이 아니에요.');
  end if;
  if v_camp.valid_until is not null and now() > v_camp.valid_until then
    return jsonb_build_object('ok', false, 'reason', '사용 기간이 지난 쿠폰이에요.');
  end if;
  if v_camp.theme_id is not null and v_camp.theme_id <> p_theme_id then
    return jsonb_build_object('ok', false, 'reason', '이 테마에는 쓸 수 없는 쿠폰이에요.');
  end if;
  if v_camp.min_headcount is not null and p_headcount < v_camp.min_headcount then
    return jsonb_build_object(
      'ok', false,
      'reason', format('%s명 이상 신청할 때 쓸 수 있는 쿠폰이에요.', v_camp.min_headcount));
  end if;

  if v_camp.restrict_to_issued_phone then
    if v_coupon.issued_to_phone_hash is null then
      return jsonb_build_object('ok', false, 'reason', '이 쿠폰은 사용할 수 없어요.');
    end if;
    if p_phone is null or hash_phone(p_phone) <> v_coupon.issued_to_phone_hash then
      return jsonb_build_object(
        'ok', false,
        'reason', '이 쿠폰은 쿠폰을 받으신 분 번호로만 사용할 수 있어요.');
    end if;
  end if;

  if v_camp.discount_type = 'fixed' then
    v_discount := v_camp.discount_value;
  else
    v_discount := floor(p_base_amount * v_camp.discount_value / 100.0)::int;
    if v_camp.max_discount_krw is not null then
      v_discount := least(v_discount, v_camp.max_discount_krw);
    end if;
  end if;

  v_discount := least(v_discount, p_base_amount);

  return jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'campaign_name', v_camp.name,
    'description', v_camp.description,
    'valid_until', v_camp.valid_until,
    'discount_krw', v_discount,
    'final_amount_krw', p_base_amount - v_discount
  );
end;
$function$;

revoke execute on function public.preview_coupon(text, uuid, integer, integer, text) from public;
grant execute on function public.preview_coupon(text, uuid, integer, integer, text) to anon, authenticated, service_role;
