-- 신청에 쿠폰을 붙이기 위한 컬럼
--
-- 적용: 운영 적용 완료 (2026-09-12) / test 는 이미 있었다
--
-- ⚠️ 이게 왜 뒤늦게 생겼나 — 운영 반영 후 실제 신청을 끝까지 해보다 발견했다.
--    쿠폰 스키마(p13)와 마찬가지로 test 의 SQL Editor 에서 직접 만들어져
--    마이그레이션에 없었다. p13 은 coupons/coupon_campaigns 테이블과 함수 4개만
--    떠 왔고, applications 쪽 컬럼과 submit_application_v2 는 빠져 있었다.
--    그 결과 운영에서 **신청 자체가 실패**했다(p18 주석 참고).
--
-- 되돌리기:
--   alter table public.applications drop column if exists coupon_id;
--   alter table public.applications drop column if exists discount_krw;

alter table public.applications
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;

alter table public.applications
  add column if not exists discount_krw integer not null default 0;

comment on column public.applications.coupon_id is
  '이 신청에 사용된 쿠폰. 쿠폰이 지워져도 신청은 남는다(on delete set null).';
comment on column public.applications.discount_krw is
  '쿠폰으로 깎인 금액. amount_krw 는 이미 할인이 반영된 값이다.';
