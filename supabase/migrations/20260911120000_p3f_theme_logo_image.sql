-- 테마 행성 로고.
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기: alter table public.themes drop column if exists logo_image_path;
--
-- 컨텐츠 목록에서 테마는 '행성'으로 떠 있다. 지금까지는 포스터를 원형으로
-- 잘라 썼는데, 포스터는 세로로 긴 그림이라 원 안에 들어가면 가운데만 남는다.
-- 테마마다 전용 행성 아트웍이 따로 있으므로 컬럼을 나눈다.
--
-- 비우면 포스터로 대체한다(기존 테마가 바로 깨지지 않게).

alter table public.themes
  add column if not exists logo_image_path text;

comment on column public.themes.logo_image_path is
  '테마 행성 로고 URL. 컨텐츠 목록·어드민 목록에서 원형으로 노출. 비우면 포스터로 대체.';
