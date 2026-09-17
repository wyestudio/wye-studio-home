-- 우리 기기에서 넣은 신청에 표시를 달아 분석에서 뺀다
--
-- 적용: test (2026-09-17 적용·이력 기록) / 운영 (미적용)
-- 되돌리기:
--   alter table applications drop column if exists is_internal;
--
-- 운영 사이트에서 직접 테스트한 신청이 어드민 분석(신청 추이·유입경로)에 섞였다(2026-09-17).
-- IP 로 거르면 LTE·다른 와이파이에서 새므로, /internal 에서 켠 기기 쿠키(wye_internal)를 본다.
-- ⚠️ 표시는 신청이 성공한 뒤 따로 쓴다(src/lib/internalTraffic.ts).
--    submit_application*() 에 파라미터를 더하지 않는다 — 2026-08-14 장애.
-- ⚠️ 분석에서만 뺀다. 정원·명단·입금 확인 같은 운영 화면에서는 그대로 보인다.

alter table applications add column if not exists is_internal boolean not null default false;

comment on column applications.is_internal is
  '우리 기기(/internal 에서 표시를 켠 브라우저)에서 넣은 신청. 어드민 분석에서 뺀다. 운영 화면에는 그대로 보인다.';
