-- 단체 견적(/group)에서 막는 회차를 노말모드만으로 좁힌다(2026-10-28 대표님).
--
-- 파티모드 회차는 신청자가 있어도 일정을 조정할 수 있어서 단체 날짜를 막지 않는다.
-- 노말모드(slug 'baotalchul-normal')에 신청(취소 제외)이 있으면 겹치는 단체 시간은 그대로 막는다.
-- 그 밖은 20261026055556_group_busy_slots.sql 과 같다.

create or replace view public.public_group_busy_slots as
select distinct
  (s.start_at at time zone 'Asia/Seoul')::date as date,
  to_char(s.start_at at time zone 'Asia/Seoul', 'HH24:MI') as start_time,
  to_char(s.end_at at time zone 'Asia/Seoul', 'HH24:MI') as end_time
from public.sessions s
join public.themes t on t.id = s.theme_id
where s.start_at >= now()
  and t.slug = 'baotalchul-normal'
  and coalesce(s.venue_id_override, t.venue_id) = (
    select g.venue_id from public.themes g where g.slug = 'baotalchul' limit 1
  )
  and exists (
    select 1 from public.applications a
    where a.session_id = s.id and a.status <> 'cancelled'
  );

comment on view public.public_group_busy_slots is
  '단체 견적 화면에서 막을 시간대 — 같은 장소에서 신청자가 있는 노말모드 회차의 날짜·시작·끝(KST). 신청자 정보는 없다.';
