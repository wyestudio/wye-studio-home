-- 슬랙 알림 포맷을 어드민에서 고칠 수 있게 한다
--
-- 적용: test (2026-09-13) · 운영 (배포와 함께)
-- 되돌리기: drop table if exists public.slack_templates;
--           (코드가 템플릿을 못 읽으면 예전 하드코딩 문구로 자동 폴백한다)
--
-- 문자(sms_templates)와 같은 방식이다. 슬랙 알림도 운영하면서 계속 손보게
-- 되는데, 그때마다 코드를 고쳐 배포하는 건 말이 안 된다.
--
-- 특히 동행자 정보를 넣고 싶다는 요청이 있었다. 인원이 몇 명일지 모르므로
-- 반복 블록 문법을 쓴다 — src/lib/messageTemplate.ts 참고.
--
--   {{#attendees}}
--   · {{name}} · {{birth_year}}년생 · {{gender}}
--   {{/attendees}}
--
-- ⚠️ 권한은 sms_templates 와 똑같이 준다 — service_role 에 select/update 만.
--    insert/delete 는 막아둔다. 템플릿은 마이그레이션으로만 늘리고, 어드민은
--    본문만 고친다(실수로 알림 종류가 사라지면 알림이 통째로 멈춘다).

create table if not exists public.slack_templates (
  key text primary key,
  label text not null,
  body text not null,
  placeholders text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.slack_templates is
  '슬랙 알림 본문. 어드민 › 설정 › 슬랙 템플릿에서 고친다. 반복 블록({{#attendees}})을 지원한다.';

alter table public.slack_templates enable row level security;

revoke all on public.slack_templates from anon, authenticated;
grant select, update on public.slack_templates to service_role;

-- ── 새 신청 ────────────────────────────────────────────────────────
insert into public.slack_templates (key, label, body, placeholders)
values (
  'application_new',
  '새 신청',
  '📥 새신청 — {{theme_name}} {{session_label}}{{status_suffix}}
접수번호: {{confirmation_code}}
인원: {{headcount}}명

{{#attendees}}
{{index}}. {{role}} {{name}}{{nickname_paren}} · {{birth_year}}년생 · {{gender}} · 방탈출 {{experience}} · {{phone}}
{{/attendees}}

입금자명: {{depositor_name}}
입금액: {{amount}}{{discount_suffix}}
신청일시: {{created_at}}
입금기한: {{payment_deadline}}

현재 인원 — 확정 {{confirmed_count}}명 · 대기 {{waiting_count}}명',
  array[
    'theme_name','session_label','status_suffix','status','confirmation_code','headcount',
    'depositor_name','amount','base_amount','discount','discount_suffix','created_at',
    'payment_deadline','confirmed_count','waiting_count','notes',
    'rep_name','rep_phone','rep_nickname','rep_birth_year','rep_gender','rep_experience'
  ]
)
on conflict (key) do nothing;

-- ── 환불 필요 (건별) ──────────────────────────────────────────────
insert into public.slack_templates (key, label, body, placeholders)
values (
  'refund_needed',
  '환불 필요 (신청 취소)',
  '💰 환불 필요 — {{theme_name}} {{session_label}}
접수번호: {{confirmation_code}}
신청자: {{rep_name}} ({{rep_phone}})
취소 주체: {{cancelled_by}}
인원: {{headcount}}명

💳 환불 금액 및 계좌
금액: {{refund_amount}}
{{refund_account_block}}',
  array[
    'theme_name','session_label','confirmation_code','headcount','cancelled_by',
    'refund_amount','refund_account_block','refund_bank','refund_account','refund_holder',
    'rep_name','rep_phone'
  ]
)
on conflict (key) do nothing;

-- ── 회차 취소로 여러 건 환불 ──────────────────────────────────────
insert into public.slack_templates (key, label, body, placeholders)
values (
  'bulk_refund_needed',
  '환불 필요 (회차 취소)',
  '💰 회차 취소로 환불 필요 {{count}}건 — {{theme_name}} {{session_label}}
합계: {{total_amount}}

{{#items}}
• `{{confirmation_code}}` {{name}} ({{phone}}) — {{amount}}{{account_suffix}}
{{/items}}',
  array['theme_name','session_label','count','total_amount']
)
on conflict (key) do nothing;
