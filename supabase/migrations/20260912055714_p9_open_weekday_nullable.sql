-- Phase 9 — 공개 요일 고정을 선택으로
--
-- 적용: test 20260912055714 (적용 완료) / 운영 적용 완료 (2026-09-12)
-- 되돌리기:
--   update theme_schedules set open_weekday = 6 where open_weekday is null;
--   alter table theme_schedules alter column open_weekday set not null;
--   (opens_at 은 어드민에서 편성을 다시 저장하면 규칙대로 다시 박힌다)
--
-- 지금까지는 "N주 전 + 지정 요일" 로만 열 수 있어서, 3주 전이 일요일인 회차도
-- 직전 토요일로 되감겨 **토·일이 한꺼번에** 열렸다. 고객에게 "3주 전에 열려요"
-- 라고 안내하려면 회차마다 자기 날짜의 정확히 3주 전에 열려야 한다.
--
-- open_weekday 를 null 허용으로 바꾸고, null 이면 되감지 않는다.

alter table theme_schedules alter column open_weekday drop not null;

comment on column theme_schedules.open_weekday is
  '공개를 고정할 요일(0=일 … 6=토). null 이면 고정하지 않고 회차마다 정확히 open_weeks_before 주 전에 연다.';

update theme_schedules set open_weekday = null;

-- 이미 만들어 둔 앞으로의 회차에 새 규칙을 다시 박는다.
--
-- ⚠️ 신청이 붙어 있는 회차는 건드리지 않는다. 공개 시각이 미래로 밀리면
--    이미 신청한 사람의 회차가 목록에서 사라진다.
update sessions s
set opens_at = (
      (((s.start_at at time zone 'Asia/Seoul')::date - (7 * ts.open_weeks_before)) + ts.open_time)
      at time zone 'Asia/Seoul'
    )
from theme_schedules ts
where ts.theme_id = s.theme_id
  and ts.open_weekday is null
  and s.start_at > now()
  and not exists (select 1 from applications a where a.session_id = s.id);
