-- 문자 템플릿의 '참여내역 조회' → '신청내역 조회'
--
-- 적용: test 20261018071443 (적용 완료, 2026-10-18) / 운영 적용 (2026-10-18, 이력 기록함)
--
-- 메뉴·조회 화면 이름이 '신청내역 조회' 로 바뀌었다(Header 의 '신청조회'). 문자만 옛 이름이면
-- 고객이 사이트에서 같은 화면을 못 찾는다. 2026-10-18 test 실측: application_confirmation_v2 한 곳.
-- ⚠️ 문장이 같을 때만 바뀐다(어드민에서 고친 템플릿은 그대로 남는다). 적용 뒤 확인:
--      select key from sms_templates where body ~ '참여 ?내역 조회';

update sms_templates
   set body = regexp_replace(body, '참여 ?내역 조회', '신청내역 조회', 'g'),
       updated_at = now()
 where body ~ '참여 ?내역 조회';
