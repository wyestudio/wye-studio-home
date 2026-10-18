-- 노말모드 전용 고객 문자 템플릿 (*_solo_v2) + 파티 템플릿의 동사를 글자로 되돌림
--
-- 적용: test (2026-10-18) / 운영 (미적용)
-- ⚠️ 운영에는 **코드 배포 뒤에** 적용해도, 앞에 적용해도 안전하다 — 지금 운영 코드는
--    *_solo_v2 를 읽지 않고, 파티 템플릿의 '신청' 은 그냥 글자다. 그래도 순서는 코드 먼저.
--
-- 왜
--   노말모드 문구가 파티와 달라졌다(2026-10-18 대표님): 입금확인은 '참여 확정' 이 아니라
--   '예약 확정', 도착은 '10분 전' 이 아니라 '15분 전'. 한 템플릿에 변수로 갈라 넣으면
--   어드민에서 고치기 어렵다 — 모드별 템플릿을 따로 두고 어드민도 탭으로 나눠 보여준다.
--
-- 어떻게 고르나 (src/lib/smsV2.ts getTemplateBodyFor)
--   노말 회차(themes.reparticipation_limit 이 비어 있음)는 '<키>_solo_v2' 를 먼저 찾고,
--   없으면 파티(기본) 템플릿을 쓴다. 공석입금안내(waitlist_promoted)는 노말에 대기가 없어 두지 않는다.
--
-- ⚠️ 이미 있는 키는 덮어쓰지 않는다(on conflict do nothing) — 어드민에서 고친 문구를 지키려고.

insert into sms_templates (key, label, body, placeholders) values
(
  'application_confirmation_solo_v2',
  '문자1 · 예약확인 (노말)',
  '[우주이스케이프] 예약 접수 안내

{{name}}님, 예약이 접수되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: {{theme_name}} {{theme_mode}}
· 일시: {{event_date}} {{start_time}} ({{duration}} 소요)
· 인원: {{attendee_count}}명

[입금 안내]
· 입금액: {{price}}
· 입금자명: {{depositor_name}}
· 입금계좌: {{bank_name}} {{account_number}} (예금주 {{account_holder}})

※ 입금자명이 위와 다르면 자동 확인이 되지 않아 처리가 늦어질 수 있습니다.
※ 입금 확인까지 최대 10분 정도 걸릴 수 있습니다.

[꼭 확인해 주세요]
· 이 회차는 만 {{min_age}}세 이상만 참여 가능하며 현장에서 신분증을 확인합니다.
· 시작 시간 15분 전까지 도착해주세요.

신청내역 조회: www.wouldyouescape.com/lookup
문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
  array['name','theme_name','theme_mode','event_date','start_time','duration','attendee_count','confirmation_code','price','bank_name','account_number','account_holder','depositor_name','min_age']
),
(
  'payment_confirmed_solo_v2',
  '문자2 · 입금확인 (노말)',
  '[우주이스케이프] 예약 확정 안내

{{name}}님, 입금이 확인되어 예약이 확정되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: {{theme_name}} {{theme_mode}}
· 일시: {{event_date}} {{start_time}} ({{duration}} 소요)
· 인원: {{attendee_count}}명
· 장소: {{venue_address_text}}

[꼭 확인해 주세요]
· 이 회차는 만 {{min_age}}세 이상만 참여 가능하며 현장에서 신분증을 확인합니다.
· 시작 시간 15분 전까지 도착해주세요.

[취소·환불 규정]
{{refund_policy}}

취소·조회: www.wouldyouescape.com/lookup
문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
  array['name','theme_name','theme_mode','event_date','start_time','duration','attendee_count','confirmation_code','venue_address_text','min_age','refund_policy']
),
(
  'event_reminder_solo_v2',
  '문자3 · 하루 전 안내 (노말)',
  '[우주이스케이프] 예약 하루 전 안내

{{name}}님, 하루 뒤 예약하신 테마 안내드립니다.
· 테마: {{theme_name}} {{theme_mode}}
· 일시: {{event_date}} {{start_time}} ({{duration}} 소요)
· 장소: {{venue_address_text}}
· 주차: {{parking_note}}

[꼭 확인해 주세요]
· 시작 시간 15분 전까지 도착해주세요.
· 방탈출 진행 중에는 휴대폰을 보관하며 종료 시점에 돌려드립니다.

[참석이 어려우시다면]
다른 팀이 예약할 수 있도록 미리 취소해 주세요. 취소 없이 불참하시면 이후 이용이 제한될 수 있습니다.
(취소 시 진행일 {{no_refund_from}}부터는 환불이 불가합니다)
취소: www.wouldyouescape.com/lookup

그럼 내일 바-ㅇ탈출에서 만나요!

문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
  array['name','theme_name','theme_mode','event_date','start_time','duration','venue_address_text','parking_note','no_refund_from']
),
(
  'application_cancelled_solo_v2',
  '문자4 · 미입금취소 (노말)',
  '[우주이스케이프] 미입금 예약 취소 안내

{{name}}님, 입금이 확인되지 않아 예약이 취소되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: {{theme_name}} {{theme_mode}}
· 일시: {{event_date}} {{start_time}}

다시 예약을 원하시면 아래에서 날짜를 선택해주세요.
{{reapply_url}}

문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
  array['name','confirmation_code','theme_name','theme_mode','event_date','start_time','reapply_url']
),
(
  'minimum_not_met_cancellation_solo_v2',
  '문자7 · 회차취소 (노말)',
  '[우주이스케이프] 예약 취소 안내

{{name}}님, 부득이한 사정으로 아래 예약이 취소되었습니다.
· 테마: {{theme_name}} {{theme_mode}}
· 일시: {{event_date}} {{start_time}}
· 인원: {{attendee_count}}명

{{refund_notice}}
불편을 드려 죄송합니다.

다른 날짜로 다시 예약하실 수 있습니다.
{{reapply_url}}

문의: 카카오톡 채널 우주이스케이프
https://pf.kakao.com/_EGNBX/chat',
  array['name','theme_name','theme_mode','event_date','start_time','attendee_count','refund_notice','reapply_url']
)
on conflict (key) do nothing;

-- 파티(기본) 템플릿은 이제 노말에 쓰이지 않으니 동사를 변수 대신 글자로 둔다 — 어드민에서 읽기 쉽게.
-- (20261018114054 에서 넣은 것을 되돌린다. 모드 줄 {{theme_mode}} 는 그대로 둔다.)
update sms_templates
   set body = replace(body, '{{booking_verb}}', '신청'),
       updated_at = now()
 where key like '%\_v2' escape '\'
   and key not like '%\_solo\_v2' escape '\'
   and body like '%{{booking_verb}}%';
