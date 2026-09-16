-- p39: 새 신청 슬랙 알림에 "어느 쿠폰을 썼는지" 추가
--
-- 왜
--   쿠폰 중복 적용(p37)이 되면서 같은 회차인데 입금액이 제각각이 됐다.
--   알림에 '(쿠폰 −6,000원)' 만 있으면 어느 이벤트로 온 손님인지 알 수 없다.
--
-- ⚠️ 본문과 placeholders 를 같이 고쳐야 한다.
--    · body        — 실제로 찍히는 문구
--    · placeholders — 어드민 편집 화면의 '사용 가능한 변수' 칩 목록
--    placeholders 만 빠지면 문구는 나오는데 대표님이 그 변수를 찾을 수 없다.
--
-- 이미 손으로 고쳐 두었을 수 있어 조건을 걸고 실행한다(여러 번 돌려도 안전).

update public.slack_templates
   set body = replace(body,
         '입금액: {{amount}}{{discount_suffix}}',
         '입금액: {{amount}}{{discount_suffix}}{{coupons_line}}'),
       updated_at = now()
 where key = 'application_new'
   and body like '%입금액: {{amount}}{{discount_suffix}}%'
   and body not like '%{{coupons_line}}%';

update public.slack_templates
   set placeholders = placeholders || array['coupons','coupons_line'],
       updated_at = now()
 where key = 'application_new'
   and not ('coupons_line' = any(placeholders));
