-- 단체 견적(/group)에서 '이미 신청자가 있는 일반 회차' 와 겹치는 시간을 막는다(2026-10-26 대표님).
--
-- 단체는 공간을 통째로 쓴다. 같은 장소의 파티 · 노말 모드 회차에 신청(취소 제외)이 한 건이라도
-- 있으면, 그 회차와 시간이 겹치는 단체 일정은 받을 수 없다.
-- 고객 화면은 applications 를 읽을 수 없으므로 '날짜 · 시작 · 끝' 만 내보내는 뷰를 둔다.
-- 누가 · 몇 명 신청했는지는 내보내지 않는다.
--
-- 장소는 단체 예약 테마(바-ㅇ탈출, slug 'baotalchul')의 장소로 본다.
-- ⚠️ 다른 테마로 단체를 받게 되면 GROUP_BOOKING_THEME_SLUGS 와 이 뷰를 같이 본다.

create or replace view public.public_group_busy_slots as
select distinct
  (s.start_at at time zone 'Asia/Seoul')::date as date,
  to_char(s.start_at at time zone 'Asia/Seoul', 'HH24:MI') as start_time,
  to_char(s.end_at at time zone 'Asia/Seoul', 'HH24:MI') as end_time
from public.sessions s
join public.themes t on t.id = s.theme_id
where s.start_at >= now()
  and coalesce(s.venue_id_override, t.venue_id) = (
    select g.venue_id from public.themes g where g.slug = 'baotalchul' limit 1
  )
  and exists (
    select 1 from public.applications a
    where a.session_id = s.id and a.status <> 'cancelled'
  );

comment on view public.public_group_busy_slots is
  '단체 견적 화면에서 막을 시간대 — 같은 장소에서 신청자가 있는 회차의 날짜·시작·끝(KST). 신청자 정보는 없다.';

revoke all on public.public_group_busy_slots from anon, authenticated;
grant select on public.public_group_busy_slots to anon, authenticated, service_role;
