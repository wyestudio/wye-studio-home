-- 회차 편성 종료일
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기: alter table public.theme_schedules drop column if exists end_date;
--
-- 비우면 계속 반복한다. 시즌제 컨텐츠처럼 끝나는 날이 정해진 테마만 채운다.

alter table public.theme_schedules
  add column if not exists end_date date;

comment on column public.theme_schedules.end_date is
  '이 날짜까지만 회차를 만든다. 비우면 무기한 반복.';
