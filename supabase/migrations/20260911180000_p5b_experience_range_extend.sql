-- 방탈출 경험 구간 확장 (200-500 / 500+)
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기: 아래 CHECK 를 옛 5개 값으로 되돌린다.
--
-- ⚠️ 순서가 중요하다. **제약을 먼저 넓힌 뒤 코드를 배포**해야 한다.
--    반대로 하면 새 값('200-500','500+')을 고른 신청이 좁은 제약에 막혀 전부 실패한다.
--    (2026-08-26 출생연도 확장 때 같은 순서로 처리한 이력이 있다)
-- ⚠️ 옛 값 '200+' 도 그대로 허용한다. 운영에는 그 값으로 저장된 8/29 신청이 있다.

alter table public.application_attendees
  drop constraint if exists application_attendees_experience_range_check;

alter table public.application_attendees
  add constraint application_attendees_experience_range_check
  check (
    experience_range is null
    or experience_range = any (array['0', '1-50', '50-100', '100-200', '200-500', '500+', '200+'])
  );
