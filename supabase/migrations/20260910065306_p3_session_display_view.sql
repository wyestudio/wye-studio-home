-- Phase 3 — session_display 뷰
--
-- 적용: test 20260910065012 / 운영 20260910065306 (둘 다 적용 완료)
-- 되돌리기: drop view if exists session_display;
--
-- 어드민 액션은 옛 회차와 새 회차를 모두 다룬다. 문자 문구에 쓰는 표시값을
-- 한 곳에서 통일한다.
-- session_view 는 themes 와 INNER JOIN 이라 theme_id 없는 옛 회차가 빠진다.
-- 이 뷰는 LEFT JOIN 이라 옛 회차도 포함한다.

create or replace view session_display as
select
  s.id,
  s.theme_id,
  s.start_at,
  s.end_at,
  s.status,
  s.min_age,
  coalesce(t.name, s.theme_name)              as theme_name,
  coalesce(s.legacy_format, s.session_type)   as format_label,
  coalesce(v.area_label, s.venue_area)        as venue_area,
  v.address                                   as venue_address,
  v.parking_note                              as venue_parking_note,
  coalesce(t.slug, s.slug)                    as link_slug,
  case when s.theme_id is not null then '/themes/' || t.slug
       else '/sessions/' || s.slug end        as public_path
from sessions s
left join themes t on t.id = s.theme_id
left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id);

comment on view session_display is
  '옛 회차와 새 회차의 표시값을 통일한 뷰. session_view 와 달리 LEFT JOIN 이라 theme_id 가 없는 과거 회차도 포함한다.';

grant select on session_display to service_role;
