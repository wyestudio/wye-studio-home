-- Phase 7 (마케팅) — 프리오픈 쿠폰 80장을 참가자 39명에게 매핑
--
-- 적용: 운영 적용 (2026-09-12) / test 는 대상 데이터(8/29 참가자)가 없어 no-op
-- 선행: 20260910100000_p7_seed_preopen_coupons.sql (코드 80장 등록)
--
-- 왜 별도 파일인가
--   coupons.issued_to_phone_hash 는 hash_phone() HMAC 값이고, 키가 Vault 에
--   환경별로 따로 들어있다. 그래서 매핑은 시드처럼 상수로 못 박을 수 없고
--   운영 DB 안에서 실제 참가자 행을 읽어 계산해야 한다.
--
-- 대상 (조회 결과로 확정, 2026-09-12)
--   8/29 회차(0829-meeting / 0829-dating) 중 status='confirmed' 이고
--   payment_status='confirmed' 인 신청의 참여자 전원.
--   → 고유 전화번호 39개 (모임 20 · 소개팅 19). 시드 파일 주석의 39명과 일치.
--   취소 건(status='cancelled')은 제외된다.
--
-- 배정 규칙
--   1인당 본인 1장 + 지인 1장. 코드 자체에 수신자 정보가 없으므로
--   (CSV 에도 사람 컬럼이 없다) **결정적 순서**로 짝을 짓는다.
--     - 수신자: phone_hash 오름차순
--     - 코드  : code 오름차순
--   같은 순번끼리 매칭. 40장 중 39장이 배정되고 종류별 1장씩 예비로 남는다.
--   issued_to_phone_hash 는 추적용일 뿐 사용 제한에 쓰이지 않으므로
--   (restrict_to_issued_phone = false) 배정이 곧 사용 권한은 아니다.
--
-- 되돌리기:
--   update coupons set issued_to_phone_hash = null
--    where campaign_id in (select id from coupon_campaigns
--                          where name in ('프리오픈 본인 할인','프리오픈 지인 할인'));

with recipients as (
  select at.phone_hash,
         row_number() over (order by at.phone_hash) as rn
  from applications a
  join sessions s on s.id = a.session_id
  join application_attendees at on at.application_id = a.id
  where s.slug in ('0829-meeting', '0829-dating')
    and a.status = 'confirmed'
    and a.payment_status = 'confirmed'
  group by at.phone_hash
),
slots as (
  select c.id as coupon_id,
         row_number() over (partition by k.name order by c.code) as rn,
         k.name as campaign_name
  from coupons c
  join coupon_campaigns k on k.id = c.campaign_id
  where k.name in ('프리오픈 본인 할인', '프리오픈 지인 할인')
    and c.issued_to_phone_hash is null   -- 이미 배정된 건 건드리지 않는다
    and c.used_at is null
)
update coupons t
   set issued_to_phone_hash = r.phone_hash
  from slots s
  join recipients r on r.rn = s.rn
 where t.id = s.coupon_id;
