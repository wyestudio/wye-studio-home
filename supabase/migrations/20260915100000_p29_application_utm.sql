-- p29 : 신청 유입경로(UTM) 기록
--
-- 왜
--   잼핏 같은 외부 플랫폼 입점이 실제 신청으로 이어지는지 알고 싶다.
--   GA4 는 '방문' 까지만 본다. **신청 한 건 한 건이 어디서 왔는지** 는
--   우리 DB 에 남겨야 회차별·기간별로 되짚어볼 수 있다.
--
-- ⚠️ submit_application_v2() 는 건드리지 않는다.
--    2026-08-14 에 이 계열 함수를 잘못 손대 서비스가 마비된 적이 있다.
--    유입경로는 신청 성공 직후 서버 액션이 service_role 로 UPDATE 한다
--    (service_role 에 applications UPDATE 권한이 이미 있다).
--    그래서 이 기록이 실패해도 신청 자체는 멀쩡하다 — 분석 값이 비는 것뿐이다.

alter table public.applications
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists utm_term     text,
  -- 어디서 넘어왔는지(외부 사이트 주소). UTM 이 없을 때 출처를 가늠하는 단서다.
  add column if not exists referrer     text,
  -- 우리 사이트에서 처음 밟은 경로. 랜딩이 홈인지 테마 상세인지 구분된다.
  add column if not exists landing_path text;

comment on column public.applications.utm_source is
  '유입경로. 신청 직후 서버 액션이 기록한다(submit_application_v2 와 무관).';
comment on column public.applications.referrer is
  'UTM 이 없을 때 출처를 가늠하는 단서. 외부 사이트 주소(origin+path).';
comment on column public.applications.landing_path is
  '우리 사이트에서 처음 연 경로. 광고가 어느 페이지로 보냈는지 본다.';

-- 분석 화면이 기간 + 출처로 묶어 세므로 그 순서로 인덱스를 둔다.
create index if not exists applications_utm_source_created_idx
  on public.applications (utm_source, created_at desc)
  where utm_source is not null;
