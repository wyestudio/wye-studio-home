-- 단체 예약 운영(관리자 개편 3단계, 2026-11-27 대표님) — 관리자 화면(4단계)에 필요한 것만.
-- 공개 폼 · 참가자 · 팀 · 리포트 표는 그 화면을 만드는 단계에 따로 더한다(한 번에 만들지 않는다).
--
-- 무엇이 생기나
--   1. group_booking_inquiries 에 진행 단계 · 행사 일시 · 예약금 · 잔금 · 결제 방식 · 학생 단체 · 취소 칸
--   2. group_booking_adjustments      금액 조정 줄(인근 기업 할인 · 인원 변경 · 총액 조정 …)
--      group_booking_history          변경 기록(누가 · 언제 · 무엇을)
--      group_checklist_templates      준비 체크리스트 양식
--      group_checklist_items          단체별 준비 체크리스트
--   3. 함수(어드민 서버 전용)
--      admin_create_group_inquiry     운영자가 단체를 직접 등록(연락처 · 이름을 암호화해 넣는다)
--      admin_confirm_group_deposit    입금 확인 = 예약 확정. 예약금 · 단계 · 마감 · 기록을 **한 묶음**으로
--      admin_reschedule_group         일정 변경. 확정 건이면 마감도 같이 옮긴다
--      admin_cancel_group             취소 · 환불 기록. 마감을 푼다
--      admin_unconfirm_group_deposit  입금 확인 취소. 마감을 푼다
--   4. 단체용 안내 문자 문구(sms_templates 의 group_* 8개) — **복사 전용.** 발송 코드와 잇지 않는다
--
-- 금액은 저장하지 않는다. 총액 · 잔금은 서버가 재료(인원 · 날짜 · 옵션 · 학생 인원 · 조정 줄 · 받은 예약금)로
-- 그때그때 계산한다(src/lib/groupSettlement.ts). 기존 unit_price · estimate_total 은 접수 시점 기록이라 그대로 둔다.
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다.
-- ⚠️ 기존 칸 · 기존 값은 지우거나 바꾸지 않는다. status(new/contacted/quoted/booked/dropped)는 그대로 두고
--    새 stage 와 같이 맞춰 쓴다. 맨 아래에서 기존 건의 새 칸만 채운다.
-- ⚠️ 새 표는 RLS 를 켜고 정책을 두지 않는다 = anon · authenticated 는 닿지 못한다. 함수도 service_role 만 부른다.
--
-- 되돌리기(새로 만든 것만 지운다 — 기존 칸은 건드리지 않는다):
--   drop function if exists public.admin_unconfirm_group_deposit(uuid, text, text);
--   drop function if exists public.admin_cancel_group(uuid, text, integer, text, jsonb);
--   drop function if exists public.admin_reschedule_group(uuid, date, text, integer, text, text, jsonb);
--   drop function if exists public.admin_confirm_group_deposit(uuid, integer, date, text, integer, text, jsonb);
--   drop function if exists public.admin_create_group_inquiry(text, text, text, text, date, text, integer, text);
--   drop function if exists public.group_closure_conflict(uuid, date, text, integer);
--   drop table if exists public.group_checklist_items, public.group_checklist_templates,
--     public.group_booking_history, public.group_booking_adjustments;
--   delete from public.sms_templates where key like 'group\_%';
--   (group_booking_inquiries 에 더한 칸과 뷰는 남겨도 옛 코드가 깨지지 않는다)

-- ════════════════════════════════════════════════════════════════════
-- 1. 접수함(group_booking_inquiries)에 더하는 칸
-- ════════════════════════════════════════════════════════════════════
alter table public.group_booking_inquiries
  -- 진행 단계. 앞으로만 간다(운영자가 한 단계 되돌릴 수 있다).
  --   new 견적 접수 → contacted 연락 완료 → confirmed 예약 확정 → d7 7일 전 안내 → d1 하루 전 안내
  --   → done 진행 완료 → report 리포트 · 후기
  -- 종료(무응답 · 취소)는 단계가 아니라 cancelled_at 으로 따로 본다 — 어느 단계에서든 끝날 수 있다.
  add column if not exists stage text not null default 'new'
    constraint group_booking_inquiries_stage_check
    check (stage in ('new', 'contacted', 'confirmed', 'd7', 'd1', 'done', 'report')),
  -- 확정(또는 협의)된 행사 일시. 비어 있으면 희망 일시(preferred_*)를 본다.
  add column if not exists event_date date,
  add column if not exists event_time text
    constraint group_booking_inquiries_event_time_check
    check (event_time is null or event_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  add column if not exists event_minutes integer
    constraint group_booking_inquiries_event_minutes_check
    check (event_minutes is null or event_minutes between 10 and 1440),
  add column if not exists is_student_group boolean not null default false,
  add column if not exists student_count integer
    constraint group_booking_inquiries_student_count_check
    check (student_count is null or student_count between 0 and 200),
  add column if not exists pay_type text not null default 'transfer'
    constraint group_booking_inquiries_pay_type_check
    check (pay_type in ('transfer', 'card_balance', 'corp_card_full')),
  -- 실제 받은 예약금과 확인 시각. 둘은 같이 있거나 같이 없다.
  add column if not exists deposit_amount integer
    constraint group_booking_inquiries_deposit_amount_check
    check (deposit_amount is null or deposit_amount between 1 and 100000000),
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists balance_paid_at timestamptz,
  -- 법인카드 전액 결제 때 행사 당일 예약금을 돌려준 시각(취소 환불과 다르다).
  add column if not exists deposit_returned_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text
    constraint group_booking_inquiries_cancel_reason_check
    check (cancel_reason is null or char_length(cancel_reason) between 2 and 200),
  add column if not exists refund_amount integer
    constraint group_booking_inquiries_refund_amount_check
    check (refund_amount is null or refund_amount between 0 and 100000000),
  -- 화면 · PPT 에 그대로 쓰는 값이라 기호를 막지 않는다. 길이만 막는다.
  add column if not exists display_name text
    constraint group_booking_inquiries_display_name_check
    check (display_name is null or char_length(display_name) between 1 and 24),
  add column if not exists welcome_text text
    constraint group_booking_inquiries_welcome_text_check
    check (welcome_text is null or char_length(welcome_text) <= 40),
  -- quote = 홈페이지 견적(/group) · manual = 운영자가 직접 등록(카카오톡 문의)
  add column if not exists source text not null default 'quote'
    constraint group_booking_inquiries_source_check
    check (source in ('quote', 'manual')),
  -- 안내 문자 종류별 마지막 복사 시각. 예: {"group_quote":"2026-11-27T05:00:00Z"}
  add column if not exists messages_copied jsonb not null default '{}'::jsonb
    constraint group_booking_inquiries_messages_copied_check
    check (jsonb_typeof(messages_copied) = 'object');

-- 예약금 금액과 확인 시각은 짝이다. 예약금이 있는데 아직 '견적 접수 · 연락 완료' 인 상태는 만들 수 없다.
alter table public.group_booking_inquiries
  drop constraint if exists group_booking_inquiries_deposit_pair_check,
  add constraint group_booking_inquiries_deposit_pair_check
    check ((deposit_amount is null) = (deposit_paid_at is null)),
  drop constraint if exists group_booking_inquiries_deposit_stage_check,
  add constraint group_booking_inquiries_deposit_stage_check
    check (deposit_paid_at is null or stage not in ('new', 'contacted'));

-- 기존 글 칸의 길이 — 접수 API(/api/group-booking)가 이미 자르는 길이와 같게 DB 에서도 막는다.
-- NOT VALID: 새로 쓰는 값만 본다. 이미 들어 있는 행은 검사하지 않는다(옛 접수분 때문에 적용이 실패하지 않게).
alter table public.group_booking_inquiries
  drop constraint if exists group_booking_inquiries_group_name_len,
  add constraint group_booking_inquiries_group_name_len check (group_name is null or char_length(group_name) <= 80) not valid,
  drop constraint if exists group_booking_inquiries_group_kind_note_len,
  add constraint group_booking_inquiries_group_kind_note_len check (group_kind_note is null or char_length(group_kind_note) <= 80) not valid,
  drop constraint if exists group_booking_inquiries_occasion_len,
  add constraint group_booking_inquiries_occasion_len check (occasion is null or char_length(occasion) <= 200) not valid,
  drop constraint if exists group_booking_inquiries_note_len,
  add constraint group_booking_inquiries_note_len check (note is null or char_length(note) <= 1500) not valid,
  drop constraint if exists group_booking_inquiries_admin_memo_len,
  add constraint group_booking_inquiries_admin_memo_len check (admin_memo is null or char_length(admin_memo) <= 4000) not valid;

-- 어드민 조회 뷰 — 새 칸은 뒤에만 붙인다(create or replace view 는 칸을 끝에만 더할 수 있다).
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
  occasion,
  stage,
  event_date,
  event_time,
  event_minutes,
  is_student_group,
  student_count,
  pay_type,
  deposit_amount,
  deposit_paid_at,
  balance_paid_at,
  deposit_returned_at,
  cancelled_at,
  cancel_reason,
  refund_amount,
  display_name,
  welcome_text,
  source,
  messages_copied
from public.group_booking_inquiries;

grant select on public.admin_group_booking_inquiries_view to service_role;

-- ════════════════════════════════════════════════════════════════════
-- 2. 새 표
-- ════════════════════════════════════════════════════════════════════

-- 금액 조정 줄. 정액(amount) 또는 기본요금의 %(pct) 중 하나, 더하기(+1) / 빼기(-1).
create table if not exists public.group_booking_adjustments (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  -- src/lib/groupSettlement.ts 의 ADJUST_REASONS 와 같은 목록
  reason_code text not null
    check (reason_code in ('nearby', 'special', 'headcount', 'student_unverified', 'total_override', 'etc')),
  label text not null check (char_length(label) between 1 and 40),
  amount integer check (amount is null or amount between 1 and 100000000),
  pct numeric(5, 2) check (pct is null or (pct > 0 and pct <= 100)),
  sign smallint not null check (sign in (1, -1)),
  -- 총액 조정처럼 사유를 꼭 적어야 하는 줄의 설명
  note text check (note is null or char_length(note) <= 200),
  created_by text not null default '어드민' check (char_length(created_by) between 1 and 40),
  created_at timestamptz not null default now(),
  constraint group_booking_adjustments_one_value check ((amount is null) <> (pct is null))
);
create index if not exists group_booking_adjustments_inquiry_idx on public.group_booking_adjustments (inquiry_id, created_at);
comment on table public.group_booking_adjustments is
  '단체 예약 금액 조정 줄. 총액은 저장하지 않고 이 줄들로 서버가 계산한다(groupSettlement.ts).';

-- 변경 기록. 단체 상세의 금액 탭 아래에 그대로 보여준다. 이름 · 연락처 같은 개인정보는 넣지 않는다.
create table if not exists public.group_booking_history (
  id bigint generated always as identity primary key,
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  kind text not null
    check (kind in ('created', 'headcount', 'schedule', 'options', 'student', 'adjustment', 'deposit',
                    'balance', 'pay_type', 'stage', 'cancel', 'info')),
  -- 한 줄 요약. 예: '14명 → 16명 · 1인 43,000 → 41,000'
  summary text not null check (char_length(summary) between 1 and 300),
  reason text check (reason is null or char_length(reason) <= 200),
  -- 되짚을 때 필요한 값(이전 · 이후).
  detail jsonb not null default '{}'::jsonb,
  actor text not null default '어드민' check (char_length(actor) between 1 and 40),
  created_at timestamptz not null default now()
);
create index if not exists group_booking_history_inquiry_idx on public.group_booking_history (inquiry_id, created_at desc);
comment on table public.group_booking_history is
  '단체 예약 변경 기록(인원 · 일정 · 옵션 · 조정 · 예약금 · 취소 · 단계). 개인정보는 넣지 않는다.';

-- 준비 체크리스트 양식. 단체가 확정되면 이 줄들이 그 단체의 체크리스트로 복사된다.
create table if not exists public.group_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  idx integer not null check (idx between 0 and 999),
  label text not null check (char_length(label) between 1 and 60),
  owner text check (owner is null or char_length(owner) <= 20),
  created_at timestamptz not null default now()
);
comment on table public.group_checklist_templates is
  '단체 준비 체크리스트 양식. 고쳐도 이미 만들어진 단체의 체크리스트는 바뀌지 않는다.';

create table if not exists public.group_checklist_items (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.group_booking_inquiries(id) on delete cascade,
  idx integer not null check (idx between 0 and 999),
  label text not null check (char_length(label) between 1 and 60),
  owner text check (owner is null or char_length(owner) <= 20),
  done_at timestamptz,
  -- 시스템이 자동으로 넣은 줄(예: 신청서의 이벤트 준비)
  auto boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists group_checklist_items_inquiry_idx on public.group_checklist_items (inquiry_id, idx);

alter table public.group_booking_adjustments enable row level security;
alter table public.group_booking_history enable row level security;
alter table public.group_checklist_templates enable row level security;
alter table public.group_checklist_items enable row level security;

revoke all on public.group_booking_adjustments, public.group_booking_history,
  public.group_checklist_templates, public.group_checklist_items from anon, authenticated;
grant select, insert, delete on public.group_booking_adjustments to service_role;
-- 기록은 넣기만 한다. 고치거나 지우지 않는다.
grant select, insert on public.group_booking_history to service_role;
grant select, insert, update, delete on public.group_checklist_templates to service_role;
grant select, insert, update, delete on public.group_checklist_items to service_role;

-- 기본 양식(시안 기준). 담당자는 비워 둔다 — 대표님이 정하면 「체크리스트 양식」 화면에서 넣는다.
insert into public.group_checklist_templates (idx, label)
select v.idx, v.label
from (values
  (0, '오프닝 PPT 모임명 · 환영 문구'),
  (1, '레크리에이션 구성'),
  (2, '다과 · 음료 준비'),
  (3, '팀 편성 확정'),
  (4, '미니게임 편성'),
  (5, '명찰 출력'),
  (6, '플레이 리포트 틀 만들기')
) as v(idx, label)
where not exists (select 1 from public.group_checklist_templates);

-- ════════════════════════════════════════════════════════════════════
-- 3. 함수 — 전부 어드민 서버(service_role) 전용
-- ════════════════════════════════════════════════════════════════════

-- 이 단체가 (날짜 · 시작 · 소요 시간)에 들어갈 때 겹치는 다른 마감이 있나. 있으면 그 마감의 설명, 없으면 null.
-- 규칙은 고객 화면(groupPricing.ts 의 closureSlots · overlapsBusy)과 같다:
--   종일 마감이면 그날 전부 막힘. 구간 마감은 앞뒤 60분(세팅 · 정리)을 넓혀서 본다.
create or replace function public.group_closure_conflict(
  p_inquiry_id uuid,
  p_date date,
  p_time text,
  p_minutes integer
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start integer := split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;
  v_end integer := v_start + p_minutes;
  c record;
  c_start integer;
  c_from integer;
  c_to integer;
begin
  for c in
    select start_time, minutes, note, inquiry_id, session_id
      from public.group_booking_closures
     where date = p_date
       and inquiry_id is distinct from p_inquiry_id
     order by start_time nulls first
  loop
    if c.start_time is null then
      return '종일 마감' || coalesce(' (' || c.note || ')', '');
    end if;
    c_start := split_part(c.start_time, ':', 1)::integer * 60 + split_part(c.start_time, ':', 2)::integer;
    c_from := greatest(0, c_start - 60);
    c_to := c_start + coalesce(c.minutes, 180) + 60;
    if c_from < v_end and c_to > v_start then
      return c.start_time || ' 시작 '
        || case when c.inquiry_id is not null then '다른 단체 확정'
                when c.session_id is not null then '파티 회차 단체 막기'
                else '직접 막은 일정' end
        || coalesce(' (' || c.note || ')', '');
    end if;
  end loop;
  return null;
end;
$$;

-- 운영자가 단체를 직접 등록한다(카카오톡으로 바로 문의한 단체).
-- 이름 · 연락처는 encrypt_pii() 로만 넣는다 — 그 함수는 service_role 에 열려 있지 않아 이 함수가 대신한다.
create or replace function public.admin_create_group_inquiry(
  p_group_name text,
  p_organizer_name text,
  p_contact_method text,
  p_contact text,
  p_preferred_date date,
  p_preferred_time text,
  p_headcount integer,
  p_memo text default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_group text := nullif(trim(coalesce(p_group_name, '')), '');
  v_name text := trim(coalesce(p_organizer_name, ''));
  v_contact text := trim(coalesce(p_contact, ''));
begin
  if p_headcount is null or p_headcount < 2 or p_headcount > 200 then
    raise exception '인원은 2~200명 사이로 넣어주세요.';
  end if;
  if v_group is null or char_length(v_group) < 2 or char_length(v_group) > 30 then
    raise exception '모임 이름은 2~30자로 넣어주세요.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 20 then
    raise exception '담당자 이름은 2~20자로 넣어주세요.';
  end if;
  if p_contact_method is null or p_contact_method not in ('kakao', 'phone', 'sms', 'email') then
    raise exception '연락 수단을 선택해주세요.';
  end if;
  if char_length(v_contact) < 1 or char_length(v_contact) > 100 then
    raise exception '연락처를 확인해주세요.';
  end if;
  if p_preferred_date is null then
    raise exception '희망 날짜를 넣어주세요.';
  end if;
  if p_preferred_time is null or p_preferred_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception '시작 시간을 확인해주세요.';
  end if;
  if p_memo is not null and char_length(p_memo) > 4000 then
    raise exception '메모가 너무 깁니다.';
  end if;

  insert into public.group_booking_inquiries (
    headcount, organizer_name_enc, contact_method, contact_enc,
    preferred_date, preferred_time, group_name, admin_memo, source, stage, status
  ) values (
    p_headcount, public.encrypt_pii(v_name), p_contact_method, public.encrypt_pii(v_contact),
    p_preferred_date, p_preferred_time, v_group, nullif(trim(coalesce(p_memo, '')), ''), 'manual', 'new', 'new'
  ) returning id into v_id;

  insert into public.group_booking_history (inquiry_id, kind, summary)
  values (v_id, 'created', '운영자가 직접 등록 · ' || p_headcount || '명');

  return v_id;
end;
$$;

-- 입금 확인 = 예약 확정. 예약금 기록 · 단계 변경 · 마감 생성 · 변경 기록을 한 트랜잭션으로 한다.
-- 그 시간이 이미 막혀 있으면 **아무것도 바꾸지 않고** 실패한다.
-- 겹치는 빈 회차를 닫는 일과 감사로그는 지금처럼 서버 코드(group-bookings/actions.ts)가 이어서 한다.
-- p_summary · p_detail: 변경 기록에 남길 한 줄과 값(금액 계산은 서버가 한다).
create or replace function public.admin_confirm_group_deposit(
  p_id uuid,
  p_amount integer,
  p_date date,
  p_time text,
  p_minutes integer,
  p_summary text,
  p_detail jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.group_booking_inquiries%rowtype;
  v_conflict text;
  v_closure_id uuid;
  v_schedule_changed boolean;
begin
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then
    raise exception '받은 금액을 확인해주세요.';
  end if;
  if p_date is null or p_time is null or p_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception '확정 날짜 · 시작 시각을 넣어주세요.';
  end if;
  if p_minutes is null or p_minutes < 10 or p_minutes > 1440 then
    raise exception '소요 시간을 확인해주세요(10분 ~ 24시간).';
  end if;
  if p_summary is null or char_length(p_summary) < 1 or char_length(p_summary) > 300 then
    raise exception '기록 문구를 확인해주세요.';
  end if;

  -- 같은 단체를 두 사람이 동시에 확정해도 한 줄씩 처리되게 잠근다.
  select * into v_row from public.group_booking_inquiries where id = p_id for update;
  if not found then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  if v_row.cancelled_at is not null then
    raise exception '취소된 단체입니다. 입금 확인을 할 수 없습니다.';
  end if;

  v_conflict := public.group_closure_conflict(p_id, p_date, p_time, p_minutes);
  if v_conflict is not null then
    raise exception '그 시간은 이미 막혀 있습니다: %', v_conflict;
  end if;

  select id into v_closure_id from public.group_booking_closures where inquiry_id = p_id;
  v_schedule_changed := v_closure_id is null
    or v_row.event_date is distinct from p_date
    or v_row.event_time is distinct from p_time
    or v_row.event_minutes is distinct from p_minutes;

  if v_closure_id is null then
    insert into public.group_booking_closures (date, start_time, minutes, inquiry_id)
    values (p_date, p_time, p_minutes, p_id)
    returning id into v_closure_id;
  else
    update public.group_booking_closures
       set date = p_date, start_time = p_time, minutes = p_minutes
     where id = v_closure_id;
  end if;

  update public.group_booking_inquiries
     set deposit_amount = p_amount,
         deposit_paid_at = coalesce(deposit_paid_at, now()),
         event_date = p_date,
         event_time = p_time,
         event_minutes = p_minutes,
         stage = case when stage in ('new', 'contacted') then 'confirmed' else stage end,
         status = 'booked',
         updated_at = now()
   where id = p_id;

  insert into public.group_booking_history (inquiry_id, kind, summary, detail)
  values (p_id, 'deposit', p_summary, coalesce(p_detail, '{}'::jsonb));

  return jsonb_build_object(
    'closure_id', v_closure_id,
    'schedule_changed', v_schedule_changed,
    'was_confirmed', v_row.deposit_paid_at is not null
  );
end;
$$;

-- 일정 변경 · 연기. 사유는 필수다. 확정 건이면 막아 둔 일정도 같이 옮긴다 — 옮길 자리가 막혀 있으면 실패한다.
-- 받은 예약금은 그대로다. 요금 재계산(평일/주말 · 성수기)은 서버가 하고, 그 결과를 p_summary 로 남긴다.
create or replace function public.admin_reschedule_group(
  p_id uuid,
  p_date date,
  p_time text,
  p_minutes integer,
  p_reason text,
  p_summary text,
  p_detail jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.group_booking_inquiries%rowtype;
  v_conflict text;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if p_date is null or p_time is null or p_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then
    raise exception '날짜 · 시작 시각을 넣어주세요.';
  end if;
  if p_minutes is null or p_minutes < 10 or p_minutes > 1440 then
    raise exception '소요 시간을 확인해주세요(10분 ~ 24시간).';
  end if;
  if char_length(v_reason) < 2 or char_length(v_reason) > 200 then
    raise exception '사유를 2~200자로 적어주세요.';
  end if;
  if p_summary is null or char_length(p_summary) < 1 or char_length(p_summary) > 300 then
    raise exception '기록 문구를 확인해주세요.';
  end if;

  select * into v_row from public.group_booking_inquiries where id = p_id for update;
  if not found then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  if v_row.cancelled_at is not null then
    raise exception '취소된 단체입니다. 일정을 바꿀 수 없습니다.';
  end if;

  if v_row.deposit_paid_at is not null then
    v_conflict := public.group_closure_conflict(p_id, p_date, p_time, p_minutes);
    if v_conflict is not null then
      raise exception '옮길 시간이 이미 막혀 있습니다: %', v_conflict;
    end if;
    update public.group_booking_closures
       set date = p_date, start_time = p_time, minutes = p_minutes
     where inquiry_id = p_id;
    if not found then
      insert into public.group_booking_closures (date, start_time, minutes, inquiry_id)
      values (p_date, p_time, p_minutes, p_id);
    end if;
  end if;

  update public.group_booking_inquiries
     set event_date = p_date, event_time = p_time, event_minutes = p_minutes, updated_at = now()
   where id = p_id;

  insert into public.group_booking_history (inquiry_id, kind, summary, reason, detail)
  values (p_id, 'schedule', p_summary, v_reason, coalesce(p_detail, '{}'::jsonb));

  return jsonb_build_object('confirmed', v_row.deposit_paid_at is not null);
end;
$$;

-- 취소 · 환불 기록. 실제 송금은 운영자가 한다 — 여기서는 금액과 사유를 남기고 막아 둔 일정을 푼다.
-- 환불액은 서버가 단체 규정(groupSettlement.ts 의 groupRefund)으로 계산해 넘긴다. 받은 예약금을 넘을 수 없다.
create or replace function public.admin_cancel_group(
  p_id uuid,
  p_reason text,
  p_refund_amount integer,
  p_summary text,
  p_detail jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.group_booking_inquiries%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 2 or char_length(v_reason) > 200 then
    raise exception '사유를 2~200자로 적어주세요.';
  end if;
  if p_summary is null or char_length(p_summary) < 1 or char_length(p_summary) > 300 then
    raise exception '기록 문구를 확인해주세요.';
  end if;

  select * into v_row from public.group_booking_inquiries where id = p_id for update;
  if not found then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  if v_row.cancelled_at is not null then
    raise exception '이미 취소된 단체입니다.';
  end if;
  if p_refund_amount is null or p_refund_amount < 0 or p_refund_amount > coalesce(v_row.deposit_amount, 0) then
    raise exception '환불액은 0원 이상, 받은 예약금 이하여야 합니다.';
  end if;

  delete from public.group_booking_closures where inquiry_id = p_id;

  update public.group_booking_inquiries
     set cancelled_at = now(),
         cancel_reason = v_reason,
         refund_amount = p_refund_amount,
         status = 'dropped',
         updated_at = now()
   where id = p_id;

  insert into public.group_booking_history (inquiry_id, kind, summary, reason, detail)
  values (p_id, 'cancel', p_summary, v_reason, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- 입금 확인 취소(잘못 눌렀을 때). 예약금 · 잔금 확인을 비우고 '연락 완료' 로 되돌리며 막아 둔 일정을 푼다.
create or replace function public.admin_unconfirm_group_deposit(
  p_id uuid,
  p_reason text,
  p_summary text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.group_booking_inquiries%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 2 or char_length(v_reason) > 200 then
    raise exception '사유를 2~200자로 적어주세요.';
  end if;
  if p_summary is null or char_length(p_summary) < 1 or char_length(p_summary) > 300 then
    raise exception '기록 문구를 확인해주세요.';
  end if;

  select * into v_row from public.group_booking_inquiries where id = p_id for update;
  if not found then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
  if v_row.cancelled_at is not null then
    raise exception '취소된 단체입니다.';
  end if;
  if v_row.deposit_paid_at is null then
    raise exception '입금 확인된 예약금이 없습니다.';
  end if;

  delete from public.group_booking_closures where inquiry_id = p_id;

  update public.group_booking_inquiries
     set deposit_amount = null,
         deposit_paid_at = null,
         balance_paid_at = null,
         stage = 'contacted',
         status = 'contacted',
         updated_at = now()
   where id = p_id;

  insert into public.group_booking_history (inquiry_id, kind, summary, reason, detail)
  values (p_id, 'deposit', p_summary, v_reason,
          jsonb_build_object('undone', true, 'deposit_amount', v_row.deposit_amount));
end;
$$;

-- Postgres 는 새 함수를 기본으로 모두에게(PUBLIC) 열어 둔다. 전부 닫고 어드민 서버에만 준다.
revoke all on function public.group_closure_conflict(uuid, date, text, integer) from public, anon, authenticated;
revoke all on function public.admin_create_group_inquiry(text, text, text, text, date, text, integer, text) from public, anon, authenticated;
revoke all on function public.admin_confirm_group_deposit(uuid, integer, date, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_reschedule_group(uuid, date, text, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_cancel_group(uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_unconfirm_group_deposit(uuid, text, text) from public, anon, authenticated;
grant execute on function public.group_closure_conflict(uuid, date, text, integer) to service_role;
grant execute on function public.admin_create_group_inquiry(text, text, text, text, date, text, integer, text) to service_role;
grant execute on function public.admin_confirm_group_deposit(uuid, integer, date, text, integer, text, jsonb) to service_role;
grant execute on function public.admin_reschedule_group(uuid, date, text, integer, text, text, jsonb) to service_role;
grant execute on function public.admin_cancel_group(uuid, text, integer, text, jsonb) to service_role;
grant execute on function public.admin_unconfirm_group_deposit(uuid, text, text) to service_role;

-- ════════════════════════════════════════════════════════════════════
-- 4. 단체용 안내 문자 문구 — 복사 전용(시스템이 보내지 않는다)
-- ════════════════════════════════════════════════════════════════════
-- 키가 group_ 로 시작한다. 일반 문자 템플릿 화면은 이 키를 빼고 보여주고, 발송 코드는 이 키를 읽지 않는다.
-- 이미 있는 키는 건드리지 않는다(운영자가 고친 문구를 덮어쓰지 않게).
insert into public.sms_templates (key, label, body, placeholders) values
('group_quote', '[단체] 견적 안내',
$t$안녕하세요, {{leader_name}}님!
우주이스케이프입니다.

단체 견적 신청해주셔서 감사합니다!

신청해주신 {{event_date}} {{event_time_ko}}, 총 {{headcount}}명 일정으로 이용 안내드립니다.

[이용 금액]
• 방탈출: {{headcount}}명 × {{unit_price}} = {{base_amount}}
{{#lines}}
• {{label}}: {{amount}}
{{/lines}}
• 총 이용 금액: {{total}}

[사전 신청폼]
{{leader_form_url}}

[예약금 안내]
예약 확정을 위해 총 이용 금액의 30%인 {{deposit_suggest}}을 아래 계좌로 입금 부탁드립니다.
• {{bank_account}}

예약은 예약금 입금 순서로 확정됩니다.

감사합니다!$t$,
array['leader_name','event_date','event_time_ko','headcount','unit_price','base_amount','lines','label','amount','total','leader_form_url','deposit_suggest','bank_account']),

('group_deposit', '[단체] 예약금 확인',
$t$예약금 {{deposit_paid}} 입금 확인되었습니다! 감사합니다.

{{event_date}} {{event_time_ko}}, 총 {{headcount}}명 일정으로 예약 확정해드렸습니다!

이용일 7일 전인 {{d7_date}}에 최종 참가 인원 확인과 함께 참가자 전용 설문을 보내드릴 예정입니다.

그전에 궁금하신 점이 생기시면 언제든 편하게 말씀해 주세요!$t$,
array['deposit_paid','event_date','event_time_ko','headcount','d7_date']),

('group_nudge', '[단체] 신청서 재촉',
$t$안녕하세요, {{leader_name}}님! 우주이스케이프입니다.

예약은 확정되어 있습니다. 모임 성격에 맞춰 프로그램을 준비할 수 있도록 아래 신청폼 작성 부탁드립니다.

{{leader_form_url}}$t$,
array['leader_name','leader_form_url']),

('group_d7_transfer', '[단체] 7일 전 안내 — 잔금 계좌이체',
$t$안녕하세요, {{leader_name}}님!

{{event_date}} {{group_name}} 단체 행사 관련하여 최종 인원 확인 및 사전 설문 안내드립니다!

[이용 일정 및 최종 인원 확인]
- 이용 일시: {{event_date}} {{event_range}}
- 참가 인원: {{headcount}}명

[최종 이용 금액 및 결제 안내]
- 최종 이용 금액: {{total}}
- 기입금 예약금: {{deposit_paid}}

[잔금 입금 안내]
- 최종 잔금: {{balance}}
- {{bank_account}}

위 계좌로 잔금 입금해 주시면 확인 후 안내드리겠습니다!

[참가자 사전 설문폼]
참가자분들께 공유해 주세요. (모임장님도 작성해 주셔야 합니다!)
제출 현황은 같은 주소 첫 화면에서 바로 확인하실 수 있습니다.
{{participant_form_url}}

[팀 구성 안내]
{{headcount}}명 기준 총 {{team_count}}팀을 추천드립니다.

감사합니다!$t$,
array['leader_name','event_date','group_name','event_range','headcount','total','deposit_paid','balance','bank_account','participant_form_url','team_count']),

('group_d7_card', '[단체] 7일 전 안내 — 잔금만 카드',
$t$안녕하세요, {{leader_name}}님!

{{event_date}} {{group_name}} 단체 행사 관련하여 최종 인원 확인 및 사전 설문 안내드립니다!

[이용 일정 및 최종 인원 확인]
- 이용 일시: {{event_date}} {{event_range}}
- 참가 인원: {{headcount}}명

[최종 이용 금액 및 결제 안내]
- 최종 이용 금액: {{total}}
- 기입금 예약금: {{deposit_paid}}

행사 당일 현장에서 잔금 {{balance}}을 카드로 결제해 주시면 됩니다!

[참가자 사전 설문폼]
참가자분들께 공유해 주세요. (모임장님도 작성해 주셔야 합니다!)
제출 현황은 같은 주소 첫 화면에서 바로 확인하실 수 있습니다.
{{participant_form_url}}

[팀 구성 안내]
{{headcount}}명 기준 총 {{team_count}}팀을 추천드립니다.

감사합니다!$t$,
array['leader_name','event_date','group_name','event_range','headcount','total','deposit_paid','balance','participant_form_url','team_count']),

('group_d7_corp_card', '[단체] 7일 전 안내 — 예약금 환불 후 전액 법인카드',
$t$안녕하세요, {{leader_name}}님!

{{event_date}} {{group_name}} 단체 행사 관련하여 최종 인원 확인 및 사전 설문 안내드립니다!

[이용 일정 및 최종 인원 확인]
- 이용 일시: {{event_date}} {{event_range}}
- 참가 인원: {{headcount}}명

[최종 이용 금액 및 결제 안내]
- 최종 이용 금액: {{total}}
- 기입금 예약금: {{deposit_paid}}

행사 당일 현장에서 예약금 {{deposit_paid}}을 반환해 드린 후, 총 이용 금액 {{total}}을 법인카드로 결제해 주시면 됩니다!

[참가자 사전 설문폼]
참가자분들께 공유해 주세요. (모임장님도 작성해 주셔야 합니다!)
제출 현황은 같은 주소 첫 화면에서 바로 확인하실 수 있습니다.
{{participant_form_url}}

[팀 구성 안내]
{{headcount}}명 기준 총 {{team_count}}팀을 추천드립니다.

감사합니다!$t$,
array['leader_name','event_date','group_name','event_range','headcount','total','deposit_paid','participant_form_url','team_count']),

('group_d1', '[단체] 하루 전 안내',
$t$안녕하세요! 우주이스케이프입니다!

내일 진행되는 단체 방탈출 관련하여 최종 안내드립니다.

[1. 도착 및 주차]
내일 행사는 {{event_time_ko}} 시작 예정으로, {{arrive_time_ko}}까지 도착 부탁드립니다. 별도 주차 공간이 없어 인근 공영주차장을 이용해 주세요.

[2. 플레이 리포트 및 사진 촬영]
행사 중 스태프가 플레이 장면과 단체 사진을 촬영합니다.

[3. 휴대폰 수거]
방탈출 시작 전 휴대폰을 일괄 수거하며, 종료 후 돌려드립니다.

감사합니다!$t$,
array['event_time_ko','arrive_time_ko']),

('group_report', '[단체] 리포트 전달',
$t$안녕하세요! 우주이스케이프입니다.

지난 {{event_date}} 진행된 {{group_name}} 단체모임 플레이 리포트 전달드립니다!

함께해 주신 모든 분께 감사 인사 전해주세요. 후기 설문도 부탁드립니다.
{{review_form_url}}$t$,
array['event_date','group_name','review_form_url'])
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- 5. 기존 건의 새 칸 채우기 — 기존 값은 그대로 두고 비어 있는 새 칸만 채운다(여러 번 돌려도 같다)
-- ════════════════════════════════════════════════════════════════════
-- 진행 단계: 기존 status 에서 옮긴다. contacted · quoted → 연락 완료, booked → 예약 확정.
update public.group_booking_inquiries
   set stage = case status when 'contacted' then 'contacted' when 'quoted' then 'contacted' when 'booked' then 'confirmed' else stage end
 where stage = 'new' and status in ('contacted', 'quoted', 'booked');

-- 확정 건의 행사 일시: 이어진 마감(확정 일시)에서 복사한다. 예약금 금액은 비워 둔다 — 운영자가 나중에 넣는다.
update public.group_booking_inquiries i
   set event_date = c.date, event_time = c.start_time, event_minutes = coalesce(c.minutes, 180)
  from public.group_booking_closures c
 where c.inquiry_id = i.id and c.start_time is not null and i.event_date is null;

-- 무응답 · 취소(dropped): 종료로 표시한다. 언제 끝났는지는 마지막 수정 시각으로 본다.
update public.group_booking_inquiries
   set cancelled_at = updated_at, cancel_reason = '기존 무응답 · 취소 건'
 where status = 'dropped' and cancelled_at is null;
