-- 단체 견적 안내 문구 — 일반용 · 회사용 (2026-11-27 대표님)
--
-- 무엇을 하나
--   · group_quote          → 「일반용」. 아직 처음 문구 그대로일 때만 새 문구로 바꾼다(운영자가 고쳐 둔 문구는 덮어쓰지 않는다).
--   · group_quote_company  → 「회사용」 줄을 새로 넣는다(이미 있으면 건드리지 않는다). 카드결제 · 세금계산서 안내가 더 들어간다.
--   모임 성격이 회사 워크숍이면 회사용이 자동으로 골라진다(코드: src/lib/groupQuoteMessage.ts).
--   문구는 그 파일의 QUOTE_DEFAULT_BODY 와 글자까지 같다(테스트 groupQuoteMessage.test.ts 가 대조한다).
--
-- 표 · 칸 · 함수 · 권한은 바꾸지 않는다. sms_templates 의 줄(문구)만 바꾼다.
-- 복사 전용 문구다 — 발송 코드는 group_ 로 시작하는 키를 읽지 않는다.
-- 여러 번 실행해도 결과가 같다.
--
-- 되돌리기
--   delete from public.sms_templates where key = 'group_quote_company';
--   group_quote 의 예전 문구는 20261127040548_group_booking_admin.sql 의 4번 구역에 있다.

update public.sms_templates
   set label = '[단체] 견적 안내 — 일반용'
 where key = 'group_quote';

-- 처음 문구(md5 로 확인) 그대로일 때만 바꾼다.
update public.sms_templates
   set body = $t$안녕하세요, {{leader_name}}님!
우주이스케이프입니다 🚀

단체 견적 신청해주셔서 감사합니다! 😊💜

신청해주신 {{event_date}} {{event_time_ko}}, 총 {{headcount}}명 일정으로 이용 안내드립니다.

[이용 일정]
• 모임명: {{group_name}}
• 일시: {{event_date_full}} {{event_start}}
• 인원: 총 {{headcount}}명
• 프로그램: {{program_hours}} ({{event_range}})
• 진행 방식: 팀별 경쟁형 방탈출

[이용 금액]
• 방탈출: {{headcount}}명 × {{unit_price}} = {{base_amount}}
{{#lines}}
• {{label}}: {{amount}}
{{/lines}}
• 총 이용 금액: {{total}}

[사전 신청폼 안내]

참여자분들의 특성과 모임 성격에 맞춰 프로그램을 준비하기 위해 사전 신청폼을 받고 있습니다.

아래 폼을 작성해주시면 감사하겠습니다!

📝 신청폼
{{leader_form_url}}

{{#deposit}}
[예약금 안내]

예약 확정을 위해 총 이용 금액의 30%인 {{deposit_suggest}}을 아래 계좌로 입금 부탁드립니다.

• 예약금: {{deposit_suggest}}
• {{bank_account}}

신청폼 제출 및 입금 확인 후 {{event_date}} {{event_time_ko}} 일정으로 최종 예약 확정해드리겠습니다!

[잔금 및 결제 안내]

• 잔금: {{balance_suggest}}
• 최종 참여 인원은 행사 7일 전인 {{d7_date}}까지 확정 부탁드립니다.
• 잔금은 최종 확정 인원을 기준으로 안내드리며, 이후 당일 불참자가 발생하더라도 확정 인원을 기준으로 정산됩니다.
{{/deposit}}
{{#fullpay}}
[결제 안내]

행사 7일 이내 예약은 전액 결제 시 확정됩니다. 총 이용 금액 {{total}}을 아래 계좌로 입금 부탁드립니다.

• 입금 금액: {{total}}
• {{bank_account}}

신청폼 제출 및 입금 확인 후 {{event_date}} {{event_time_ko}} 일정으로 최종 예약 확정해드리겠습니다!

• 당일 불참자가 발생하더라도 확정 인원을 기준으로 정산됩니다.
{{/fullpay}}

입금 후 말씀해주시면 확인 도와드리겠습니다!

추가로 궁금하신 사항이 있으시면 언제든 편하게 문의해 주세요.

감사합니다! 😊$t$,
       placeholders = array['leader_name','event_date','event_time_ko','headcount','group_name','event_date_full','event_start','program_hours','event_range','unit_price','base_amount','lines','label','amount','total','leader_form_url','deposit','deposit_suggest','bank_account','balance_suggest','d7_date','fullpay'],
       updated_at = now()
 where key = 'group_quote'
   and md5(body) = '4f4b3d96a182c02a2215b9536198b9e4';

insert into public.sms_templates (key, label, body, placeholders) values
('group_quote_company', '[단체] 견적 안내 — 회사용',
$t$안녕하세요, {{leader_name}}님!
우주이스케이프입니다 🚀

단체 견적 신청해주셔서 감사합니다! 😊💜

신청해주신 {{event_date}} {{event_time_ko}}, 총 {{headcount}}명 일정으로 이용 안내드립니다.

[이용 일정]
• 모임명: {{group_name}}
• 일시: {{event_date_full}} {{event_start}}
• 인원: 총 {{headcount}}명
• 프로그램: {{program_hours}} ({{event_range}})
• 진행 방식: 팀별 경쟁형 방탈출

[이용 금액]
• 방탈출: {{headcount}}명 × {{unit_price}} = {{base_amount}}
{{#lines}}
• {{label}}: {{amount}}
{{/lines}}
• 총 이용 금액: {{total}}

[사전 신청폼 안내]

참여자분들의 특성과 모임 성격에 맞춰 프로그램을 준비하기 위해 사전 신청폼을 받고 있습니다.

아래 폼을 작성해주시면 감사하겠습니다!

📝 신청폼
{{leader_form_url}}

{{#deposit}}
[예약금 안내]

예약 확정을 위해 총 이용 금액의 30%인 {{deposit_suggest}}을 아래 계좌로 입금 부탁드립니다.

• 예약금: {{deposit_suggest}}
• {{bank_account}}

신청폼 제출 및 입금 확인 후 {{event_date}} {{event_time_ko}} 일정으로 최종 예약 확정해드리겠습니다!

[잔금 및 결제 안내]

• 잔금: {{balance_suggest}}
• 최종 참여 인원은 행사 7일 전인 {{d7_date}}까지 확정 부탁드립니다.
• 잔금은 최종 확정 인원을 기준으로 안내드리며, 이후 당일 불참자가 발생하더라도 확정 인원을 기준으로 정산됩니다.
• 카드결제 및 세금계산서 발행도 가능합니다.
• 카드결제를 희망하실 경우, 이용 당일 기존 계좌이체 금액을 환불한 후 카드결제로 변경해드릴 수 있습니다.
{{/deposit}}
{{#fullpay}}
[결제 안내]

행사 7일 이내 예약은 전액 결제 시 확정됩니다. 총 이용 금액 {{total}}을 아래 계좌로 입금 부탁드립니다.

• 입금 금액: {{total}}
• {{bank_account}}

신청폼 제출 및 입금 확인 후 {{event_date}} {{event_time_ko}} 일정으로 최종 예약 확정해드리겠습니다!

• 당일 불참자가 발생하더라도 확정 인원을 기준으로 정산됩니다.
• 카드결제 및 세금계산서 발행도 가능합니다.
{{/fullpay}}

입금 후 말씀해주시면 확인 도와드리겠습니다!

추가로 궁금하신 사항이 있으시면 언제든 편하게 문의해 주세요.

감사합니다! 😊$t$,
array['leader_name','event_date','event_time_ko','headcount','group_name','event_date_full','event_start','program_hours','event_range','unit_price','base_amount','lines','label','amount','total','leader_form_url','deposit','deposit_suggest','bank_account','balance_suggest','d7_date','fullpay'])
on conflict (key) do nothing;
