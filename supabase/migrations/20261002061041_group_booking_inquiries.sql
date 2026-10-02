-- 단체 예약 견적 신청(10~24명) 접수함.
--
-- 왜 applications 에 섞지 않는가
--   이 폼은 신청이 아니다. 고를 회차도, 정원도, 결제도 없다. 접수된 뒤 일정 협의와
--   예약금 입금을 거쳐야 비로소 예약이 된다. applications 에 넣으면 정원 집계·신청
--   퍼널·정산이 전부 흔들린다.
--
-- ⚠️ 연락처는 전화번호·카카오톡 ID·이메일 중 하나다. 전부 개인정보이므로
--    encrypt_pii() 로만 넣고, 어드민은 아래 뷰(decrypt_pii)를 통해서만 읽는다.
--    평문 칸을 따로 두지 않는다 — 한 번 두면 그게 유출 경로가 된다.

create table if not exists public.group_booking_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- 예상 인원. 화면은 10~24 로 받지만(테마 정원 24), 상한을 그대로 박지 않는다 —
  -- "30명인데 되나요" 가 들어오면 문구만 고쳐서 받을 수 있어야 한다.
  headcount integer not null check (headcount between 2 and 200),

  -- 어떻게 연락할지. 이 넷은 운영 수단이라 잘 안 바뀌어서 제약을 건다.
  contact_method text not null
    check (contact_method in ('kakao', 'phone', 'sms', 'email')),
  contact_enc bytea not null,

  -- 희망 일시. 날짜는 '미정이면 가장 유력한 날' 로 받으므로 확정이 아니다.
  preferred_date date,
  -- 시간대·모임 성격은 **제약을 걸지 않는다.** 선택지 문구가 상품에 따라 바뀌는
  -- 값이라, 제약을 걸면 문구 한 줄 고칠 때마다 마이그레이션이 필요해진다.
  -- 허용 목록은 src/lib/groupBooking.ts 에 있고 API 가 거른다.
  preferred_time text not null,
  group_kind text not null,
  note text,

  -- 유입경로. 신청(applications)과 달리 접수 시점에 같이 넣는다 — 뒤에 UPDATE 할
  -- 이유가 없다(신청은 submit 함수를 건드리지 않으려고 분리했다).
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,

  -- 운영 추적용. 접수함이지 예약이 아니므로 '확정' 까지 가는 단계를 여기서 센다.
  status text not null default 'new'
    check (status in ('new', 'contacted', 'quoted', 'booked', 'dropped')),
  admin_memo text,
  updated_at timestamptz not null default now()
);

comment on table public.group_booking_inquiries is
  '단체 예약 견적 신청 접수함. 예약이 아니라 상담 요청이다 (/group).';

create index if not exists group_booking_inquiries_created_at_idx
  on public.group_booking_inquiries (created_at desc);

-- 정책을 하나도 두지 않는다 = anon·authenticated 는 이 표에 닿지 못한다.
-- 넣는 길은 아래 security definer 함수 하나뿐이고, 읽는 길은 service_role 뿐이다.
alter table public.group_booking_inquiries enable row level security;

-- 어드민 전용 조회 뷰. 연락처를 복호화해서 보여준다.
-- (decrypt_pii 는 service_role 에만 허용돼 있어 anon 이 이 뷰를 읽어도 값이 안 나온다)
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
  updated_at
from public.group_booking_inquiries;

create or replace function public.submit_group_booking_inquiry(
  p_headcount integer,
  p_contact_method text,
  p_contact text,
  p_preferred_date date,
  p_preferred_time text,
  p_group_kind text,
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
  -- 화면에서도 거르지만 여기서 한 번 더 본다. 함수는 anon 이 직접 부를 수 있다.
  if p_headcount is null or p_headcount < 2 or p_headcount > 200 then
    raise exception '예상 참여 인원을 확인해주세요.';
  end if;
  if p_contact_method is null or p_contact_method not in ('kakao', 'phone', 'sms', 'email') then
    raise exception '연락 수단을 선택해주세요.';
  end if;
  if p_contact is null or length(trim(p_contact)) = 0 then
    raise exception '연락처를 입력해주세요.';
  end if;
  if p_preferred_time is null or length(trim(p_preferred_time)) = 0 then
    raise exception '예상 이용 시간을 선택해주세요.';
  end if;
  if p_group_kind is null or length(trim(p_group_kind)) = 0 then
    raise exception '모임 성격을 선택해주세요.';
  end if;

  insert into public.group_booking_inquiries (
    headcount, contact_method, contact_enc,
    preferred_date, preferred_time, group_kind, note,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path
  ) values (
    p_headcount,
    p_contact_method,
    encrypt_pii(trim(p_contact)),
    p_preferred_date,
    trim(p_preferred_time),
    trim(p_group_kind),
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

revoke all on function public.submit_group_booking_inquiry(
  integer, text, text, date, text, text, text, jsonb
) from public;
grant execute on function public.submit_group_booking_inquiry(
  integer, text, text, date, text, text, text, jsonb
) to anon, authenticated;

-- ⚠️ 새 표·뷰에는 service_role 도 권한이 자동으로 붙지 않는다. 빼먹으면 어드민
--    화면이 "permission denied for view ..." 로 떨어진다(협찬 뷰도 같은 grant 가
--    있다). anon·authenticated 에는 주지 않는다 — 연락처가 복호화돼 보이는 뷰다.
grant select on public.admin_group_booking_inquiries_view to service_role;
-- 어드민이 진행 상태·메모를 고친다. 넣는 것은 위 함수가 하므로 insert 는 주지 않는다.
grant select, update on public.group_booking_inquiries to service_role;
