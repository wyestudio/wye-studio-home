-- 장소안내(문자3)를 동행자 전원에게 — 발송 표시를 신청 단위에서 참여자 단위로
--
-- 적용: test · 운영 (2026-09-12)
-- 되돌리기:
--   drop function if exists public.mark_attendee_reminder_sent(uuid[]);
--   alter table public.application_attendees drop column if exists reminder_sms_sent_at;
--   (뷰는 그 컬럼을 뺀 정의로 create or replace)
--
-- 지금까지 문자3 은 신청 건의 **대표 신청자 한 명**에게만 갔다. 4명이 함께
-- 신청하면 나머지 3명은 장소를 직접 못 받고 대표가 전달해야 했다.
-- 장소는 당일 필수 정보라 전원에게 보내기로 했다.
--
-- ⚠️ 그러면 발송 표시도 참여자 단위여야 한다.
--    applications.reminder_sms_sent_at 하나로 관리하면, 4명 중 1명만 발송이
--    실패했을 때 선택지가 둘 다 나쁘다:
--      · 신청을 '발송됨' 으로 찍는다  → 실패한 1명은 영영 못 받는다
--      · 안 찍는다                    → 다음 실행이 4명 전원에게 다시 보낸다(중복)
--    참여자마다 표시를 두면 실패한 사람만 정확히 재시도된다.
--
-- ⚠️ service_role 은 application_attendees 에 대한 테이블 권한이 아예 없다
--    (의도된 잠금 — CLAUDE.md 의 "grant 를 안 주는 것이 1차 방어선").
--    그래서 UPDATE 를 직접 하지 않고 SECURITY DEFINER 함수를 통한다.

alter table public.application_attendees
  add column if not exists reminder_sms_sent_at timestamptz;

comment on column public.application_attendees.reminder_sms_sent_at is
  '장소안내(문자3)를 이 참여자에게 보낸 시각. null 이면 아직 안 보냄.';

-- 이미 대표에게 안내가 나간 신청의 참여자는 '발송됨' 으로 채운다.
-- 이 백필이 없으면 배포 직후 크론이 옛 참가자 전원에게 다시 문자를 보낸다.
update public.application_attendees aa
   set reminder_sms_sent_at = a.reminder_sms_sent_at
  from public.applications a
 where a.id = aa.application_id
   and a.reminder_sms_sent_at is not null
   and aa.reminder_sms_sent_at is null;

-- ⚠️ create or replace view 는 컬럼 순서를 못 바꾼다(42P16). 반드시 뒤에 붙인다.
create or replace view public.admin_attendee_view as
 SELECT id,
    application_id,
    session_id,
    is_representative,
    decrypt_pii(name_enc) AS name,
    decrypt_pii(phone_enc) AS phone,
    birth_year,
    nickname,
    gender,
    experience_range,
    created_at,
    reminder_sms_sent_at
   FROM application_attendees aa;

-- 발송 표시 전용 함수. 이미 표시된 건은 건드리지 않아(두 번 호출돼도 안전)
-- 실제로 새로 표시한 개수를 돌려준다.
create or replace function public.mark_attendee_reminder_sent(p_attendee_ids uuid[])
returns integer
language sql
security definer
set search_path to 'public'
as $$
  with upd as (
    update application_attendees
       set reminder_sms_sent_at = now()
     where id = any(p_attendee_ids)
       and reminder_sms_sent_at is null
    returning 1
  )
  select coalesce(count(*), 0)::int from upd;
$$;

comment on function public.mark_attendee_reminder_sent(uuid[]) is
  '장소안내 문자를 실제로 받은 참여자에게 발송 시각을 남긴다. 어드민 서버 액션·크론 전용.';

revoke execute on function public.mark_attendee_reminder_sent(uuid[]) from public;
grant execute on function public.mark_attendee_reminder_sent(uuid[]) to service_role;
