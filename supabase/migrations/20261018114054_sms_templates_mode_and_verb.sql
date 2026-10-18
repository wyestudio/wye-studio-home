-- 고객 문자 템플릿에 모드와 '신청/예약' 동사를 넣는다 (노말모드)
--
-- 적용: test (2026-10-18) / 운영 (미적용 — 코드 배포 뒤에)
-- ⚠️ 운영에는 **코드 배포 뒤에** 적용한다. {{booking_verb}} 를 채우는 코드(smsV2.ts)가
--    먼저 올라가 있지 않으면 문자에 '{{booking_verb}}' 가 글자 그대로 나간다.
--
-- 왜
--   노말모드 예약 고객에게 "[우주이스케이프] 신청 접수 안내", "테마: 바-ㅇ탈출" 로
--   나갔다(2026-10-18 운영 테스트). 두 모드의 테마명이 같아 어느 모드인지 알 수 없고,
--   노말은 '예약' 이라 부른다.
--
-- 바꾸는 것
--   1. "· 테마: {{theme_name}}" → "· 테마: {{theme_name}} {{theme_mode}}" (모드 없는 테마는 빈 값)
--   2. 문구 속 '신청' → {{booking_verb}} ('신청' | '예약'). '신청내역 조회' 는 화면 이름이라 둔다.
--      두 말 다 받침이 있어 뒤 조사(이/을)는 그대로 맞는다.
-- ⚠️ 문장이 정확히 같을 때만 바뀐다(replace). 어드민에서 이미 고친 문장은 그대로 남는다.
-- ⚠️ 여러 번 돌려도 같다 — 이미 바뀐 문장은 찾는 문자열과 맞지 않는다.

update sms_templates
   set body = replace(body, '· 테마: {{theme_name}}' || chr(10), '· 테마: {{theme_name}} {{theme_mode}}' || chr(10)),
       updated_at = now()
 where key like '%\_v2' escape '\'
   and body like '%· 테마: {{theme_name}}' || chr(10) || '%';

update sms_templates
   set body = replace(replace(body,
         '[우주이스케이프] 신청 접수 안내', '[우주이스케이프] {{booking_verb}} 접수 안내'),
         '{{name}}님, 신청이 접수되었습니다.', '{{name}}님, {{booking_verb}}이 접수되었습니다.'),
       updated_at = now()
 where key = 'application_confirmation_v2';

update sms_templates
   set body = replace(replace(replace(body,
         '미입금 신청 취소 안내', '미입금 {{booking_verb}} 취소 안내'),
         '입금이 확인되지 않아 신청이 취소되었습니다.', '입금이 확인되지 않아 {{booking_verb}}이 취소되었습니다.'),
         '다시 신청을 원하시면', '다시 {{booking_verb}}을 원하시면'),
       updated_at = now()
 where key = 'application_cancelled_v2';

update sms_templates
   set body = replace(body, '다른 날짜로 다시 신청하실 수 있습니다.', '다른 날짜로 다시 {{booking_verb}}하실 수 있습니다.'),
       updated_at = now()
 where key = 'minimum_not_met_cancellation_v2';
