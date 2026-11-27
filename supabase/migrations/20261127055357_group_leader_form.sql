-- 단체 예약 모임장 신청서(관리자 개편 5단계 둘째 묶음, 2026-11-27 대표님).
--
-- 무엇이 생기나
--   group_leader_responses              모임장 신청서 답. 단체마다 한 줄. 휴대폰 번호는 암호화
--   admin_group_leader_responses_view   어드민 서버 전용. 휴대폰 번호 · 바뀐 담당자 이름을 복호화해 보여준다
--   함수(전부 서버 전용 — service_role 만 부른다. 공개 키로는 부를 수 없다)
--     submit_group_leader_form        신청서 저장(검증 · 횟수 제한 · 잠금). 모임 이름 · 화면 표시 모임명 · 환영 문구만 단체에 바로 반영
--     verify_group_leader_phone       제출한 신청서를 다시 볼 때 — 휴대폰 번호 끝 4자리 확인(5번 틀리면 15분 잠금)
--     request_group_leader_edit       모임장의 수정 요청(끝 4자리 확인 후)
--     admin_set_group_contact         담당자 연락처 변경(암호화해야 해서 함수로)
--     admin_apply_group_leader_name   신청서에 적힌 새 담당자 이름을 단체에 반영
--
-- 정한 것(2026-11-27 대표님)
--   · 신청서 휴대폰 번호는 **따로 보관**한다. 단체의 기존 연락처(대부분 카카오톡 ID · 이메일)는 바꾸지 않는다.
--   · 날짜 · 시간 · 인원 · 옵션이 견적과 다르면 바로 바꾸지 않고 pending 에 올려 운영자가 반영한다.
--     pending 은 서버 액션이 견적과 비교해 만든다(이 함수는 받은 대로 저장만 한다).
--
-- 보안
--   · RLS 를 켜고 정책을 두지 않는다 = anon · authenticated 는 닿지 못한다.
--   · 휴대폰 번호 · 이름은 encrypt_pii() 로만 넣는다. 끝 4자리 비교도 DB 안에서 한다(전체 번호가 서버 밖으로 나가지 않는다).
--   · 끝 4자리가 틀려도 예외를 던지지 않고 결과 글자를 돌려준다 — 예외를 던지면 틀린 횟수 기록까지 되돌려져 잠금이 걸리지 않는다.
--
-- ⚠️ 운영에는 **코드 배포 전에** 적용한다. 앞선 마이그레이션(group_booking_admin · group_forms)이 먼저 있어야 한다.
--
-- 되돌리기:
--   drop function if exists public.admin_apply_group_leader_name(uuid);
--   drop function if exists public.admin_set_group_contact(uuid, text, text);
--   drop function if exists public.request_group_leader_edit(text, text, text, text);
--   drop function if exists public.verify_group_leader_phone(text, text, text);
--   drop function if exists public.submit_group_leader_form(text, jsonb, text, text, text, text, text, text, text, jsonb, integer, text);
--   drop view if exists public.admin_group_leader_responses_view;
--   drop table if exists public.group_leader_responses;

-- ── 1. 표 ───────────────────────────────────────────────────────────
create table if not exists public.group_leader_responses (
  inquiry_id uuid primary key references public.group_booking_inquiries(id) on delete cascade,
  template_version integer not null default 1 check (template_version between 1 and 100000),
  -- 문항 id → 답. 열쇠 · 선택지 · 글자 수는 서버 액션이 양식과 대조해 거른 뒤 넘긴다. 여기서는 모양과 크기를 막는다.
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 20000),
  -- 모임장 휴대폰 번호. 제출한 신청서를 다시 볼 때 끝 4자리로 본인을 확인한다.
  phone_enc bytea not null,
  -- 「담당자가 바뀌었어요」 로 적은 새 담당자 이름. 운영자가 반영하기 전까지는 여기에만 있다.
  leader_name_enc bytea,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submit_count integer not null default 1 check (submit_count between 1 and 1000),
  -- 제출하면 잠긴다(보기 전용). 운영자가 「수정 열어주기」 를 누르면 풀리고, 다시 제출하면 다시 잠긴다.
  locked boolean not null default true,
  edit_request text check (edit_request is null or char_length(edit_request) between 2 and 300),
  edit_requested_at timestamptz,
  -- 견적과 다른 내용(인원 · 일시 · 옵션 · 담당자) — 운영자가 「반영」 하거나 「넘기기」 하면 줄이 빠진다.
  pending jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pending) = 'array' and octet_length(pending::text) <= 4000),
  -- 운영자가 답을 직접 고쳤을 때 — 누가 언제.
  admin_updated_by text check (admin_updated_by is null or char_length(admin_updated_by) <= 100),
  admin_updated_at timestamptz,
  -- 끝 4자리 확인 실패 횟수와 잠금.
  verify_fails integer not null default 0 check (verify_fails between 0 and 100),
  verify_locked_until timestamptz
);
comment on table public.group_leader_responses is
  '단체 모임장 신청서. 단체마다 한 줄. 휴대폰 번호는 암호화. 어드민 서버만 읽는다.';

alter table public.group_leader_responses enable row level security;
revoke all on public.group_leader_responses from anon, authenticated;
grant select on public.group_leader_responses to service_role;
-- 운영자가 고칠 수 있는 칸만 연다. 휴대폰 번호 · 이름(암호화 칸)과 확인 실패 기록은 함수만 쓴다.
grant update (answers, locked, edit_request, edit_requested_at, pending, admin_updated_by, admin_updated_at, updated_at)
  on public.group_leader_responses to service_role;

-- 어드민 서버 전용 조회 뷰. 화면에는 서버가 **가려서** 내려주고, 「연락처 보기」 를 눌렀을 때만 전체 값을 준다.
create or replace view public.admin_group_leader_responses_view as
select
  inquiry_id,
  template_version,
  answers,
  public.decrypt_pii(phone_enc) as phone,
  case when leader_name_enc is null then null else public.decrypt_pii(leader_name_enc) end as leader_name,
  submitted_at,
  updated_at,
  submit_count,
  locked,
  edit_request,
  edit_requested_at,
  pending,
  admin_updated_by,
  admin_updated_at
from public.group_leader_responses;
revoke all on public.admin_group_leader_responses_view from anon, authenticated;
grant select on public.admin_group_leader_responses_view to service_role;

-- ── 2. 함수 ─────────────────────────────────────────────────────────

-- 신청서 제출. 처음이면 새로 넣고, 운영자가 수정을 열어 준 상태면 덮어쓴다. 잠겨 있으면 거절한다.
-- 휴대폰 번호를 비워 보내면: 고쳐 내는 경우에는 전에 낸 번호를, 처음이면 단체 연락처가 휴대폰 번호일 때 그 번호를 쓴다.
create or replace function public.submit_group_leader_form(
  p_token text,
  p_answers jsonb,
  p_phone text,
  p_leader_name text,
  p_group_name text,
  p_group_kind text,
  p_group_kind_note text,
  p_display_name text,
  p_welcome_text text,
  p_pending jsonb,
  p_template_version integer,
  p_ip_hash text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inquiry uuid;
  v_row public.group_leader_responses%rowtype;
  v_has boolean;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := nullif(trim(coalesce(p_leader_name, '')), '');
  v_group text := trim(coalesce(p_group_name, ''));
  v_kind text := nullif(trim(coalesce(p_group_kind, '')), '');
  v_kind_note text := nullif(trim(coalesce(p_group_kind_note, '')), '');
  v_display text := nullif(trim(coalesce(p_display_name, '')), '');
  v_welcome text := nullif(trim(coalesce(p_welcome_text, '')), '');
  v_method text;
  v_contact text;
  v_phone_enc bytea;
begin
  v_inquiry := public.group_form_guard(p_token, 'leader', p_ip_hash);

  select * into v_row from public.group_leader_responses where inquiry_id = v_inquiry for update;
  v_has := found;
  if v_has and v_row.locked then
    raise exception '이미 제출한 신청서예요. 고칠 내용은 수정 요청으로 남겨주세요.';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception '답변을 확인해주세요.';
  end if;
  if char_length(v_group) < 2 or char_length(v_group) > 30 or v_group ~ '[[:cntrl:]]' then
    raise exception '모임 이름은 2~30자로 적어주세요.';
  end if;
  if v_kind is not null and char_length(v_kind) > 20 then
    raise exception '모임 성격을 다시 골라주세요.';
  end if;
  if v_kind_note is not null and char_length(v_kind_note) > 50 then
    raise exception '기타 내용은 50자까지 쓸 수 있어요.';
  end if;
  if v_display is not null and (char_length(v_display) > 24 or v_display ~ '[[:cntrl:]]') then
    raise exception '화면 표시 모임명은 24자까지 쓸 수 있어요.';
  end if;
  if v_welcome is not null and (char_length(v_welcome) > 40 or v_welcome ~ '[[:cntrl:]]') then
    raise exception '환영 문구는 40자까지 쓸 수 있어요.';
  end if;
  if v_name is not null and (char_length(v_name) < 2 or char_length(v_name) > 20 or v_name ~ '[0-9[:cntrl:]]') then
    raise exception '이름은 한글이나 영문으로 입력해주세요.';
  end if;
  if p_pending is not null and jsonb_typeof(p_pending) <> 'array' then
    raise exception '답변을 확인해주세요.';
  end if;

  -- 휴대폰 번호
  if v_phone <> '' then
    if v_phone !~ '^010\d{8}$' then
      raise exception '010으로 시작하는 11자리 번호를 입력해주세요.';
    end if;
    v_phone_enc := public.encrypt_pii(v_phone);
  elsif v_has then
    v_phone_enc := v_row.phone_enc;
  else
    select contact_method, regexp_replace(public.decrypt_pii(contact_enc), '\D', '', 'g')
      into v_method, v_contact
      from public.group_booking_inquiries where id = v_inquiry;
    if v_method in ('phone', 'sms') and v_contact ~ '^010\d{8}$' then
      v_phone_enc := public.encrypt_pii(v_contact);
    else
      raise exception '010으로 시작하는 11자리 번호를 입력해주세요.';
    end if;
  end if;

  if v_has then
    update public.group_leader_responses
       set answers = p_answers,
           phone_enc = v_phone_enc,
           leader_name_enc = case when v_name is null then leader_name_enc else public.encrypt_pii(v_name) end,
           template_version = coalesce(p_template_version, 1),
           pending = coalesce(p_pending, '[]'::jsonb),
           updated_at = now(),
           submit_count = least(1000, submit_count + 1),
           locked = true,
           edit_request = null,
           edit_requested_at = null,
           verify_fails = 0,
           verify_locked_until = null
     where inquiry_id = v_inquiry;
  else
    insert into public.group_leader_responses (inquiry_id, template_version, answers, phone_enc, leader_name_enc, pending)
    values (
      v_inquiry, coalesce(p_template_version, 1), p_answers, v_phone_enc,
      case when v_name is null then null else public.encrypt_pii(v_name) end,
      coalesce(p_pending, '[]'::jsonb)
    );
  end if;

  -- 금액 · 일정과 상관없는 값만 단체 정보에 바로 반영한다.
  update public.group_booking_inquiries
     set group_name = v_group,
         group_kind = coalesce(v_kind, group_kind),
         group_kind_note = case when v_kind is null then group_kind_note else v_kind_note end,
         display_name = coalesce(v_display, display_name),
         welcome_text = v_welcome,
         updated_at = now()
   where id = v_inquiry;

  insert into public.group_booking_history (inquiry_id, kind, summary, actor)
  values (v_inquiry, 'info', case when v_has then '모임장 신청서 수정 제출' else '모임장 신청서 제출' end, '모임장');

  return case when v_has then 'updated' else 'created' end;
end;
$$;

-- 제출한 신청서를 다시 볼 때 — 휴대폰 번호 끝 4자리 확인.
-- 돌려주는 값: 'ok' · 'mismatch' · 'locked'(5번 틀려 15분 잠금) · 'none'(아직 신청서가 없다)
create or replace function public.verify_group_leader_phone(p_token text, p_last4 text, p_ip_hash text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inquiry uuid;
  v_row public.group_leader_responses%rowtype;
begin
  v_inquiry := public.group_form_guard(p_token, 'leader', p_ip_hash);
  select * into v_row from public.group_leader_responses where inquiry_id = v_inquiry for update;
  if not found then
    return 'none';
  end if;
  if v_row.verify_locked_until is not null and v_row.verify_locked_until > now() then
    return 'locked';
  end if;
  if coalesce(p_last4, '') ~ '^\d{4}$' and right(public.decrypt_pii(v_row.phone_enc), 4) = p_last4 then
    update public.group_leader_responses set verify_fails = 0, verify_locked_until = null where inquiry_id = v_inquiry;
    return 'ok';
  end if;
  if v_row.verify_fails + 1 >= 5 then
    update public.group_leader_responses
       set verify_fails = 0, verify_locked_until = now() + interval '15 minutes'
     where inquiry_id = v_inquiry;
    return 'locked';
  end if;
  update public.group_leader_responses set verify_fails = verify_fails + 1 where inquiry_id = v_inquiry;
  return 'mismatch';
end;
$$;

-- 모임장의 수정 요청. 끝 4자리가 맞아야 남긴다. 돌려주는 값은 verify_group_leader_phone 과 같다.
create or replace function public.request_group_leader_edit(p_token text, p_last4 text, p_text text, p_ip_hash text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_state text;
  v_inquiry uuid;
  v_text text := trim(coalesce(p_text, ''));
begin
  if char_length(v_text) < 2 or char_length(v_text) > 300 then
    raise exception '수정 요청은 2~300자로 적어주세요.';
  end if;
  v_state := public.verify_group_leader_phone(p_token, p_last4, p_ip_hash);
  if v_state <> 'ok' then
    return v_state;
  end if;
  select inquiry_id into v_inquiry from public.group_form_links
   where token = p_token and form_key = 'leader' and revoked_at is null;
  update public.group_leader_responses
     set edit_request = v_text, edit_requested_at = now()
   where inquiry_id = v_inquiry;
  insert into public.group_booking_history (inquiry_id, kind, summary, actor)
  values (v_inquiry, 'info', '모임장 신청서 수정 요청', '모임장');
  return 'ok';
end;
$$;

-- 담당자 연락처 변경. 연락처는 암호화해 넣어야 해서 함수로 한다. 기록(history)은 서버 코드가 남긴다(값은 남기지 않는다).
create or replace function public.admin_set_group_contact(p_inquiry_id uuid, p_contact_method text, p_contact text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_contact text := trim(coalesce(p_contact, ''));
begin
  if p_contact_method is null or p_contact_method not in ('kakao', 'phone', 'sms', 'email') then
    raise exception '연락 방법을 골라주세요.';
  end if;
  if char_length(v_contact) < 2 or char_length(v_contact) > 100 or v_contact ~ '[[:cntrl:]]' then
    raise exception '연락처를 2~100자로 적어주세요.';
  end if;
  if p_contact_method in ('phone', 'sms') then
    v_contact := regexp_replace(v_contact, '\D', '', 'g');
    if v_contact !~ '^0\d{8,10}$' then
      raise exception '전화번호를 확인해주세요.';
    end if;
  end if;
  update public.group_booking_inquiries
     set contact_method = p_contact_method,
         contact_enc = public.encrypt_pii(v_contact),
         updated_at = now()
   where id = p_inquiry_id;
  if not found then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
end;
$$;

-- 신청서에 적힌 새 담당자 이름을 단체에 반영한다(암호화된 값을 그대로 옮긴다 — 이름이 서버 밖으로 나가지 않는다).
create or replace function public.admin_apply_group_leader_name(p_inquiry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name bytea;
begin
  select leader_name_enc into v_name from public.group_leader_responses where inquiry_id = p_inquiry_id;
  if v_name is null then
    raise exception '신청서에 새 담당자 이름이 없습니다.';
  end if;
  update public.group_booking_inquiries set organizer_name_enc = v_name, updated_at = now() where id = p_inquiry_id;
  if not found then
    raise exception '단체를 찾을 수 없습니다.';
  end if;
end;
$$;

-- Postgres 는 새 함수를 기본으로 모두에게(PUBLIC) 열어 둔다. 전부 닫고 서버(service_role)에만 준다.
revoke all on function public.submit_group_leader_form(text, jsonb, text, text, text, text, text, text, text, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.verify_group_leader_phone(text, text, text) from public, anon, authenticated;
revoke all on function public.request_group_leader_edit(text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_group_contact(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_apply_group_leader_name(uuid) from public, anon, authenticated;
grant execute on function public.submit_group_leader_form(text, jsonb, text, text, text, text, text, text, text, jsonb, integer, text) to service_role;
grant execute on function public.verify_group_leader_phone(text, text, text) to service_role;
grant execute on function public.request_group_leader_edit(text, text, text, text) to service_role;
grant execute on function public.admin_set_group_contact(uuid, text, text) to service_role;
grant execute on function public.admin_apply_group_leader_name(uuid) to service_role;
