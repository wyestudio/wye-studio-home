-- 입금 확인 시각을 문자 발송 시각과 분리한다
--
-- 적용: test · 운영 (2026-09-12)
-- 되돌리기:
--   (뷰는 paid_at 을 뺀 정의로 create or replace)
--   alter table public.applications drop column if exists paid_at;
--
-- ⚠️ 무엇이 어긋나 있었나
--    payment_confirmed_sms_sent_at 은 이름 그대로 '입금확인 문자를 보낸 시각' 인데,
--    어드민 수동 등록(adminManualApply)에서 markPaid 를 켜면 **문자를 보내지 않고도**
--    이 값을 찍고 있었다(로그에는 '안내 문자 발송 안 함' 이라고 남는데도).
--    어드민 상세 화면은 이 값을 '입금확인일시' 로 그대로 보여주므로
--    운영자가 보내지도 않은 문자의 발송 시각을 보게 된다.
--
--    게다가 대시보드가 이 값을 '입금했었는가' 의 근거로 쓰고 있어서
--    8/29 팀 내부 테스트 신청 5건(입금자명 '테스트'·'김종진'·'이은지')이
--    영원히 '환불 대기' 로 잡혔다.
--
-- ⚠️ 왜 payment_status 로 못 세나
--    취소되면 payment_status 가 'cancelled' 로 덮여서 '입금했었는지' 가 지워진다.
--    그래서 취소돼도 남는 별도 컬럼이 필요하다.
--
-- 앞으로:
--   · confirmPayment        → paid_at + payment_confirmed_sms_sent_at (문자 실제 발송)
--   · adminManualApply(markPaid) → paid_at 만 (문자 안 보냄)

alter table public.applications
  add column if not exists paid_at timestamptz;

comment on column public.applications.paid_at is
  '입금이 확인된 시각. 취소되어 payment_status 가 cancelled 로 덮여도 남는다 — 환불 대상 판별용.';

-- 기존 데이터 백필: 지금까지는 입금확인 문자 발송 시각이 사실상 '입금 확인 시각' 이었다.
update public.applications
   set paid_at = payment_confirmed_sms_sent_at
 where payment_confirmed_sms_sent_at is not null
   and paid_at is null;

-- ⚠️ create or replace view 는 컬럼 순서를 못 바꾼다(42P16). 반드시 뒤에 붙인다.
create or replace view public.admin_application_view as
 SELECT id,
    session_id,
    decrypt_pii(depositor_name_enc) AS depositor_name,
    consent_required,
    consent_optional,
    confirmation_code,
    status,
    payment_status,
    notes,
    created_at,
    refund_bank_name,
    decrypt_pii(refund_account_number_enc) AS refund_account_number,
    decrypt_pii(refund_account_holder_enc) AS refund_account_holder,
    consent_photo,
    consent_marketing,
    payment_confirmed_sms_sent_at,
    refund_completed_at,
    promoted_from_waiting_at,
    paid_at
   FROM applications ap;
