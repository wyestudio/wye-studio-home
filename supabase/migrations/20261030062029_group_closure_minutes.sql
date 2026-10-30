-- 단체 일정 마감을 '회차(11:30 · 15:30 · 19:30)' 가 아니라 '시작 시각 + 소요 시간' 구간으로 받는다(2026-10-30 대표님).
-- 평일·주말 모두 시간이 계속 조정돼서 고정 회차로는 막을 수 없었다.
--
-- minutes: start_time 부터 몇 분 동안 막는가. start_time 이 null(종일)이면 쓰지 않는다.
-- 이미 막아 둔 회차 마감은 지금까지처럼 3시간(단체 기본 시간)으로 채운다.
-- ⚠️ null 을 허용한다 — 이 마이그레이션 뒤 코드가 배포되기 전까지 옛 어드민이 minutes 없이 넣는다.
--    읽는 쪽은 null 을 180 으로 본다.

alter table public.group_booking_closures
  add column if not exists minutes integer check (minutes is null or minutes between 10 and 1440);

update public.group_booking_closures
   set minutes = 180
 where start_time is not null and minutes is null;

comment on column public.group_booking_closures.minutes is
  'start_time 부터 막는 시간(분). start_time 이 null(종일)이면 쓰지 않는다. null 이면 180 으로 본다.';

-- 고객 화면용 뷰에 구간 길이를 더한다(열은 뒤에 붙여야 replace 된다).
create or replace view public.public_group_booking_closures as
select distinct c.date, c.start_time, c.minutes
from public.group_booking_closures c
where c.date >= current_date;

comment on view public.public_group_booking_closures is
  '단체 견적 화면에서 마감으로 보여 줄 날짜·구간. start_time 이 null 이면 종일 마감, 아니면 start_time 부터 minutes 분.';
