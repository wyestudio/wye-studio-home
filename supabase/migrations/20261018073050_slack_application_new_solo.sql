-- 노말모드(단독 진행) 새 예약 슬랙 알림 템플릿
--
-- 적용: test 20261018073142 (적용 완료, 2026-10-18) / 운영 적용 (2026-10-18, 이력 기록함)
--
-- 왜
--   노말 예약은 이름·휴대폰만 받는다(2026-10-18). 새 신청 알림(application_new)을 그대로
--   쓰면 "-년생 · - · 방탈출 -" 처럼 빈 칸이 줄마다 찍히고, 어느 모드인지도 안 보인다.
--   보내는 쪽(slackV2.ts sendApplicationSlackAlertV2)이 노말이면 이 키를 읽는다.
--
-- ⚠️ 템플릿은 마이그레이션으로만 늘린다(어드민은 본문만 고친다 — p25 참고).
-- ⚠️ 변수 이름은 slackV2.ts 의 vars · attendeeRow 와 같아야 한다. {{theme_mode}} 는 이번에 새로 생겼다.
-- ⚠️ 여러 번 돌려도 같다(on conflict do nothing) — 어드민에서 고친 본문을 덮어쓰지 않는다.

insert into public.slack_templates (key, label, body, placeholders)
values (
  'application_new_solo',
  '새 예약 (노말모드)',
  '📥 새예약 — {{theme_name}} {{theme_mode}} {{session_label}}{{status_suffix}}
접수번호: {{confirmation_code}}
인원: {{headcount}}명

{{#attendees}}
{{index}}. {{role}} {{name}} · {{phone}}
{{/attendees}}

입금자명: {{depositor_name}}
입금액: {{amount}}{{discount_suffix}}{{coupons_line}}
예약일시: {{created_at}}
입금기한: {{payment_deadline}}',
  array[
    'theme_name','theme_mode','session_label','status_suffix','status','confirmation_code','headcount',
    'depositor_name','amount','base_amount','discount','discount_suffix','coupons','coupons_line',
    'created_at','payment_deadline','confirmed_count','waiting_count','rep_name','rep_phone'
  ]
)
on conflict (key) do nothing;
