-- 미입금 알림도 어드민에서 고칠 수 있게
--
-- 적용: test · 운영 (배포와 함께)
-- 되돌리기: delete from public.slack_templates where key = 'unpaid_alert';
--           (지우면 코드의 폴백 문구로 나간다 — 알림이 멈추지는 않는다)
--
-- p25 에서 신청·환불 알림만 템플릿으로 옮겼는데, 미입금 알림도 같이 고칠 수
-- 있어야 한다는 요청이 있었다. 한 통에 여러 건을 묶는 구조라 {{#items}}
-- 반복 블록을 쓴다(회차취소 환불 알림과 같은 방식).
--
-- ⚠️ "자동 취소되지 않습니다" 줄을 기본 문구에 넣어둔다. 이 알림을 받는
--    사람이 "시스템이 알아서 취소했겠지" 라고 오해하면 실제로 올 손님을
--    놓친다. 지우는 건 운영자 판단이지만, 기본값으로는 반드시 있어야 한다.
--    배경: src/app/api/cron/unpaid-alert/route.ts 주석

insert into public.slack_templates (key, label, body, placeholders)
values (
  'unpaid_alert',
  '미입금 알림 (입금기한 초과)',
  '⏰ 입금기한({{deadline_minutes}}분) 넘긴 미입금 신청 {{count}}건

{{#items}}
• `{{confirmation_code}}` {{depositor_name}} — {{theme_name}} {{session_label}} (신청 후 {{minutes_elapsed}}분 경과)
{{/items}}
{{overflow_line}}
자동 취소되지 않습니다. 확인 후 어드민에서 처리해주세요.
{{admin_url}}',
  array['deadline_minutes','count','overflow_line','overflow_count','admin_url']
)
on conflict (key) do nothing;
