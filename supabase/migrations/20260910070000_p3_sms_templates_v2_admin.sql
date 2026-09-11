-- Phase 3 — 어드민 문자 템플릿 신규판 (문자4·6·7)
--
-- 적용: test 적용 완료 / ⚠️ 운영 미적용 (Phase 4 오픈 전 반드시 적용할 것)
-- 되돌리기:
--   delete from sms_templates
--   where key in ('application_cancelled_v2','waitlist_promoted_v2','minimum_not_met_cancellation_v2');
--
-- 옛 템플릿과 다른 점:
--   · 음주 문구 제거 (2026-09 정책: 전 회차 음주 없음)
--   · [프리오픈] 표기 제거
--   · 연령 제한을 회차별 {{min_age}} 로 치환 (18:00 기준 만16 / 만19)
--   · 재신청 링크를 회차 URL 이 아니라 테마 페이지로 (회차는 매주 바뀐다)
--   · 문자7 환불 문장을 {{refund_notice}} 로 통째 치환 — 회차 비활성화는
--     입금 전 대기자까지 취소하므로 "입금하신 금액 전액 환불" 을 고정할 수 없다

insert into sms_templates (key, label, body, placeholders) values
('application_cancelled_v2', '문자4 · 미입금취소 (신규)',
'[우주이스케이프] 신청이 취소되었습니다.

{{name}}님, 입금이 확인되지 않아 신청이 취소되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: {{theme_name}}
· 일시: {{event_date}} {{start_time}}

다시 신청을 원하시면 아래에서 날짜를 선택해주세요.
{{reapply_url}}

문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
 array['name','confirmation_code','theme_name','event_date','start_time','reapply_url']),

('waitlist_promoted_v2', '문자6 · 공석입금안내 (신규)',
'[우주이스케이프] 자리가 생겼습니다. 입금 안내드립니다.

{{name}}님, 대기하시던 회차에 자리가 생겨 참여가 가능해졌습니다.
· 접수번호: {{confirmation_code}}
· 테마: {{theme_name}}
· 일시: {{event_date}} {{start_time}} ({{duration}} 소요)
· 인원: {{attendee_count}}명

[입금 안내]
· 입금액: {{price}}
· 입금자명: {{depositor_name}}
· 입금계좌: {{bank_name}} {{account_number}} (예금주 {{account_holder}})

※ 입금자명이 위와 다르면 자동 확인이 되지 않아 처리가 늦어질 수 있습니다.
※ 이 회차는 만 {{min_age}}세 이상만 참여 가능합니다.

취소·조회: www.wouldyouescape.com/lookup
문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
 array['name','confirmation_code','theme_name','event_date','start_time','duration','attendee_count','price','bank_name','account_number','account_holder','depositor_name','min_age']),

('minimum_not_met_cancellation_v2', '문자7 · 회차취소 (신규)',
'[우주이스케이프] 회차가 취소되었습니다.

{{name}}님, 부득이한 사정으로 아래 회차가 취소되었습니다.
· 테마: {{theme_name}}
· 일시: {{event_date}} {{start_time}}
· 인원: {{attendee_count}}명

{{refund_notice}}
불편을 드려 죄송합니다.

다른 날짜로 다시 신청하실 수 있습니다.
{{reapply_url}}

문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
 array['name','theme_name','event_date','start_time','attendee_count','refund_notice','reapply_url'])
on conflict (key) do update
  set body = excluded.body, label = excluded.label,
      placeholders = excluded.placeholders, updated_at = now();
