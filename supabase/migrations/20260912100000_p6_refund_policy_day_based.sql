-- 환불 규정 변경 — 시각(48/24h) → 날짜(4/3/2일) 기준
--
-- 적용: test 적용 완료 (2026-09-12) / ⚠️ 운영 미적용
-- 되돌리기: 아래 문구를 48/24시간 버전으로 되돌린다(이전 내용은 git 히스토리에).
--
-- 새 규정:
--   · 진행일 4일 전까지 취소 → 100% 환불
--   · 진행일 3일 전 취소     → 50% 환불
--   · 진행일 2일 전부터      → 환불 불가
--
-- ⚠️ 시각이 아니라 날짜로 센다. 예전에는 "시작 48시간 전"이라 같은 '이틀 전'
--    이라도 회차 시각(11:30 / 19:30)에 따라 결과가 달랐다. 고객은 날짜로 생각한다.
--    판정 코드는 src/lib/refundPolicy.ts 한 곳에만 있다 — 문구와 같이 바꿀 것.

update public.sms_templates
set body = replace(
      body,
      '[환불 규정]' || chr(10) ||
      '· 48시간 전 취소: 전액 환불' || chr(10) ||
      '· 24시간 전 취소: 50% 환불' || chr(10) ||
      '· 24시간 이내 취소: 환불불가',
      '[환불 규정]' || chr(10) ||
      '· 4일 전까지 취소: 전액 환불' || chr(10) ||
      '· 3일 전 취소: 50% 환불' || chr(10) ||
      '· 2일 전부터: 환불 불가'
    ),
    updated_at = now()
where body like '%48시간 전 취소%';

update public.sms_templates
set body = replace(body, '(24시간 이내 취소 환불불가)', '(진행일 2일 전부터는 환불 불가)'),
    updated_at = now()
where body like '%24시간 이내 취소 환불불가%';

-- ── 신 구조 템플릿(_v2)에 환불 규정 추가 ─────────────────────────────
--
-- ⚠️ 옛 템플릿(payment_confirmed)에는 환불 규정이 있었는데, 테마 구조로 새로
--    쓴 _v2 에는 통째로 빠져 있었다. 지금 나가는 확정 문자에 취소 규정이
--    한 줄도 없다는 뜻이다. 규정을 고치는 김에 같이 채운다.
--    (문구는 어드민 '문자 템플릿' 화면에서 언제든 고칠 수 있다)

update public.sms_templates
set body = replace(
      body,
      '취소·조회: www.wouldyouescape.com/lookup',
      '[취소·환불 규정]' || chr(10) ||
      '· 4일 전까지 취소: 전액 환불' || chr(10) ||
      '· 3일 전 취소: 50% 환불' || chr(10) ||
      '· 2일 전부터: 환불 불가' || chr(10) || chr(10) ||
      '취소·조회: www.wouldyouescape.com/lookup'
    ),
    updated_at = now()
where key = 'payment_confirmed_v2'
  and body not like '%취소·환불 규정%';

update public.sms_templates
set body = replace(
      body,
      '대기하고 계신 분들을 위해 미리 취소해 주세요. 취소 없이 불참하시면 이후 이용이 제한될 수 있습니다.',
      '대기하고 계신 분들을 위해 미리 취소해 주세요. 취소 없이 불참하시면 이후 이용이 제한될 수 있습니다.' || chr(10) ||
      '(진행일 2일 전부터는 환불이 불가합니다)'
    ),
    updated_at = now()
where key = 'event_reminder_v2'
  and body not like '%2일 전부터는 환불%';
