-- 노말모드 요금 구간을 확정가로 바꾼다 (2인 33,000 / 3인 30,000 / 4인 이상 28,000, 인당)
--
-- 적용: test 20261018013233 (적용 완료, 2026-10-18) / 운영 (미적용)
--
-- 20261009012233 이 임시가(35,000 / 32,000 / 29,000)로 넣은 행을 고친다.
-- 운영에는 두 파일이 순서대로 들어가므로 결과는 확정가가 된다.
--
-- ⚠️ 이미 접수된 신청의 금액은 바뀌지 않는다 — 신청은 제출 순간의 금액을 따로 저장한다.
-- ⚠️ 여러 번 돌려도 같은 결과여야 한다.

update theme_price_tiers x
   set unit_price_krw = v.unit_price_krw
  from themes t
  cross join (values (2, 33000), (3, 30000), (4, 28000)) as v(min_headcount, unit_price_krw)
 where t.slug = 'baotalchul-normal'
   and x.theme_id = t.id
   and x.min_headcount = v.min_headcount
   and x.unit_price_krw is distinct from v.unit_price_krw;
