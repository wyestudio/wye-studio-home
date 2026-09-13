-- 테마 '잠금' 을 별도 스위치로 분리
--
-- 적용: test (2026-09-13) · 운영 (미적용 — 배포와 함께)
-- 되돌리기: alter table public.themes drop column if exists is_locked;
--
-- 지금까지 '잠긴 행성'(홈·컨텐츠 목록의 자물쇠)은 is_active = false 로 대신
-- 표현하고 있었다. 그런데 is_active 의 본래 뜻은 '신청 받기' 라, 신청만 잠시
-- 닫고 싶은 테마까지 자물쇠가 씌워진다. 둘은 다른 일이므로 스위치를 나눈다.
--
--   is_active  — 신청 받기
--   is_listed  — 컨텐츠 목록·검색엔진 노출
--   is_locked  — 잠금(자물쇠). 목록에는 나오되 들어갈 수 없고 색인도 안 된다.
--
-- ⚠️ 백필이 필요하다. 지금 is_active = false 인 테마('???')는 잠금 의도로
--    꺼둔 것이므로, 컬럼만 추가하면 그 순간 자물쇠가 풀려 버린다.

alter table public.themes
  add column if not exists is_locked boolean not null default false;

comment on column public.themes.is_locked is
  '잠금. 목록에는 나오지만 상세로 들어갈 수 없고(자물쇠) 검색엔진 색인에서도 빠진다. 신청 여부(is_active)와는 별개다.';

-- 옛 표현 방식을 새 컬럼으로 옮긴다. 한 번만 의미가 있다.
update public.themes set is_locked = true where is_active = false;

-- 최소 연령 규칙이 '시작 18시' 에서 '종료 22시' 로 바뀐 지 오래인데
-- 컬럼 설명만 옛 규칙으로 남아 있었다 (이용약관 제9조 제1항).
comment on column public.themes.min_age_floor is
  '테마 자체의 최소 연령 하한. 종료 시각 규칙(22:00 이전 종료 만 16세 / 이후 만 19세)보다 높으면 이 값이 적용된다.';
