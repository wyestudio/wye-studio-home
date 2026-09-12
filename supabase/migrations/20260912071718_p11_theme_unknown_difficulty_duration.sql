-- Phase 11 — 난이도·소요시간 '미정'(0) 허용
--
-- 적용: test 20260912071718 (적용 완료) / 운영 (미적용)
-- 되돌리기:
--   update themes set difficulty = 1 where difficulty = 0;
--   update themes set duration_minutes = 1 where duration_minutes = 0;
--   alter table themes drop constraint themes_difficulty_check,
--     add constraint themes_difficulty_check check (difficulty >= 1 and difficulty <= 5);
--   alter table themes drop constraint themes_duration_minutes_check,
--     add constraint themes_duration_minutes_check check (duration_minutes > 0);
--
-- 아직 만들지 않은 테마("???")를 미리 띄워 두려는데 난이도·소요시간이 정해지지
-- 않았다. 1 로 넣어두면 화면에 "난이도 1/5 · 1분" 으로 나가 버린다.
-- 0 을 '미정' 으로 쓰고, 화면에서는 그 줄을 아예 감춘다.
--
-- ⚠️ 코드보다 **먼저** 적용해야 한다. 반대 순서면 0 을 저장하려는 순간 제약에 막힌다.
-- ⚠️ 소요시간 0 인 테마로 회차를 편성하면 종료 시각이 시작 시각과 같아진다.
--    아직 열지 않는 테마에만 쓸 것.

alter table themes drop constraint themes_difficulty_check;
alter table themes add constraint themes_difficulty_check
  check (difficulty >= 0 and difficulty <= 5);

alter table themes drop constraint themes_duration_minutes_check;
alter table themes add constraint themes_duration_minutes_check
  check (duration_minutes >= 0);

comment on column themes.difficulty is '난이도 1~5. 0 은 미정 — 화면에서 감춘다.';
comment on column themes.duration_minutes is '소요시간(분). 0 은 미정 — 화면에서 감춘다.';
