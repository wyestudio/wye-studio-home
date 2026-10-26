-- 단체 예약 견적 v2 — 단계형 견적(/group)과 운영자 마감 표시
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. 새 코드는 submit_group_booking_inquiry_v2 와
--    public_group_booking_closures 를 부른다. v1 함수는 지우지 않는다 — 배포가 끝나기
--    전까지 운영의 옛 코드가 v1 을 부른다.
--
-- 무엇이 바뀌나
--   1. 접수함(group_booking_inquiries)에 견적 단계에서 고른 값과 신청서 칸을 더한다.
--      담당자 이름은 개인정보라 연락처처럼 encrypt_pii() 로만 넣는다.
--   2. 모임 성격이 필수에서 선택으로 바뀐다(not null 해제).
--   3. 운영자가 날짜·회차를 '마감' 으로 표시하는 표를 만든다. 단체 일정 데이터가
--      따로 없어서 견적은 '희망 일시' 로 받되, 이미 찬 날은 운영자가 막는다(2026-10-25 대표님).

-- ── 1. 접수함 칸 ──
alter table public.group_booking_inquiries
  add column if not exists organizer_name_enc bytea,
  add column if not exists group_name text,
  add column if not exists group_kind_note text,
  -- 견적 단계 선택값: {"icebreaking":true,"character":false,"after_party_hours":2,"cleanup":true}
  add column if not exists options jsonb,
  -- 서버가 다시 계산한 금액. 화면이 보낸 금액은 믿지 않는다. 요금표가 없는 날짜·25명 이상은 null.
  add column if not exists unit_price integer,
  add column if not exists estimate_total integer,
  add column if not exists team_style text,
  add column if not exists repeat_player text,
  add column if not exists occasion text;

alter table public.group_booking_inquiries alter column group_kind drop not null;

-- 새 칸은 뒤에만 붙인다(create or replace view 는 칸을 끝에만 더할 수 있다).
create or replace view public.admin_group_booking_inquiries_view as
select
  id,
  created_at,
  headcount,
  contact_method,
  public.decrypt_pii(contact_enc) as contact,
  preferred_date,
  preferred_time,
  group_kind,
  note,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term,
  referrer,
  landing_path,
  status,
  admin_memo,
  updated_at,
  case when organizer_name_enc is null then null
       else public.decrypt_pii(organizer_name_enc) end as organizer_name,
  group_name,
  group_kind_note,
  options,
  unit_price,
  estimate_total,
  team_style,
  repeat_player,
  occasion
from public.group_booking_inquiries;

grant select on public.admin_group_booking_inquiries_view to service_role;

-- ── 2. 접수 함수 v2 ──
create or replace function public.submit_group_booking_inquiry_v2(
  p_headcount integer,
  p_organizer_name text,
  p_contact_method text,
  p_contact text,
  p_preferred_date date,
  p_preferred_time text,
  p_options jsonb,
  p_unit_price integer,
  p_estimate_total integer,
  p_group_name text default null,
  p_group_kind text default null,
  p_group_kind_note text default null,
  p_team_style text default null,
  p_repeat_player text default null,
  p_occasion text default null,
  p_note text default null,
  p_attribution jsonb default '{}'::jsonb
) returns uuid
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  -- 화면·API 에서도 거르지만 여기서 한 번 더 본다. 함수는 anon 이 직접 부를 수 있다.
  if p_headcount is null or p_headcount < 2 or p_headcount > 200 then
    raise exception '예상 참여 인원을 확인해주세요.';
  end if;
  if p_organizer_name is null or length(trim(p_organizer_name)) = 0 then
    raise exception '담당자 이름을 입력해주세요.';
  end if;
  if p_contact_method is null or p_contact_method not in ('kakao', 'phone', 'sms', 'email') then
    raise exception '연락 수단을 선택해주세요.';
  end if;
  if p_contact is null or length(trim(p_contact)) = 0 then
    raise exception '연락처를 입력해주세요.';
  end if;
  if p_preferred_date is null then
    raise exception '희망 날짜를 선택해주세요.';
  end if;
  if p_preferred_time is null or length(trim(p_preferred_time)) = 0 then
    raise exception '희망 시간을 선택해주세요.';
  end if;
  -- 운영자가 막아 둔 날짜·회차. 종일 마감(start_time null)이거나 같은 회차면 거부한다.
  if exists (
    select 1 from public.group_booking_closures c
    where c.date = p_preferred_date
      and (c.start_time is null or c.start_time = trim(p_preferred_time))
  ) then
    raise exception '선택한 일정은 마감되었습니다. 다른 날짜나 시간을 골라주세요.';
  end if;

  insert into public.group_booking_inquiries (
    headcount, organizer_name_enc, contact_method, contact_enc,
    preferred_date, preferred_time, options, unit_price, estimate_total,
    group_name, group_kind, group_kind_note, team_style, repeat_player, occasion, note,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path
  ) values (
    p_headcount,
    encrypt_pii(trim(p_organizer_name)),
    p_contact_method,
    encrypt_pii(trim(p_contact)),
    p_preferred_date,
    trim(p_preferred_time),
    coalesce(p_options, '{}'::jsonb),
    p_unit_price,
    p_estimate_total,
    nullif(trim(coalesce(p_group_name, '')), ''),
    nullif(trim(coalesce(p_group_kind, '')), ''),
    nullif(trim(coalesce(p_group_kind_note, '')), ''),
    nullif(trim(coalesce(p_team_style, '')), ''),
    nullif(trim(coalesce(p_repeat_player, '')), ''),
    nullif(trim(coalesce(p_occasion, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_source', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_medium', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_campaign', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_content', '')), ''),
    nullif(trim(coalesce(p_attribution->>'utm_term', '')), ''),
    nullif(trim(coalesce(p_attribution->>'referrer', '')), ''),
    nullif(trim(coalesce(p_attribution->>'landing_path', '')), '')
  ) returning id into v_id;

  return v_id;
end;
$$;

-- ── 3. 운영자 마감 표시 ──
create table if not exists public.group_booking_closures (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  -- null = 그날 종일 마감. 값이 있으면 그 회차만('11:30' 처럼 HH:MM).
  start_time text check (start_time is null or start_time ~ '^\d{2}:\d{2}$'),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists group_booking_closures_slot_idx
  on public.group_booking_closures (date, coalesce(start_time, ''));

comment on table public.group_booking_closures is
  '단체 견적(/group)에서 고를 수 없게 막아 둔 날짜·회차. 어드민 > 단체 예약 문의에서 관리한다.';

-- 정책을 두지 않는다 = anon·authenticated 는 표에 직접 닿지 못한다. 쓰는 건 어드민(service_role) 뿐.
alter table public.group_booking_closures enable row level security;
grant select, insert, delete on public.group_booking_closures to service_role;

-- 고객 화면용. 메모(note)는 운영자 메모라 내보내지 않는다.
-- distinct 는 뷰를 '갱신 불가' 로 만들려는 것이기도 하다 — 권한이 새도 뷰로 표를 못 고친다.
create or replace view public.public_group_booking_closures as
select distinct c.date, c.start_time
from public.group_booking_closures c
where c.date >= current_date;

comment on view public.public_group_booking_closures is
  '단체 견적 화면에서 마감으로 보여 줄 날짜·회차. start_time 이 null 이면 종일 마감.';

revoke all on public.public_group_booking_closures from anon, authenticated;
grant select on public.public_group_booking_closures to anon, authenticated;

-- 함수는 마감 표를 읽어야 하므로 표를 만든 뒤에 권한을 준다.
revoke all on function public.submit_group_booking_inquiry_v2(
  integer, text, text, text, date, text, jsonb, integer, integer,
  text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.submit_group_booking_inquiry_v2(
  integer, text, text, text, date, text, jsonb, integer, integer,
  text, text, text, text, text, text, text, jsonb
) to anon, authenticated;
