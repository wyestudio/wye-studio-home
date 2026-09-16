-- Phase 43 — 회차 태그를 어드민(대시보드)에서 켜고 끄기 + 인기 회차 3개 추가
--
-- 적용: test (미적용) / 운영 (미적용)
-- 되돌리기: session_display 를 p43 이전 정의로 create or replace
--
-- 대시보드 회차 목록은 session_display 를 읽는다. 켜고 끄려면 지금 값이 보여야 해서
-- 뷰에 badge 를 흘려보낸다(p42 에서 session_view 에는 이미 넣었다).
-- ⚠️ create or replace 는 맨 끝에만 칸을 더할 수 있다.

create or replace view session_display as
select s.id,
  s.theme_id,
  s.start_at,
  s.end_at,
  s.status,
  s.min_age,
  coalesce(t.name, s.theme_name) as theme_name,
  coalesce(s.legacy_format, s.session_type) as format_label,
  coalesce(v.area_label, s.venue_area) as venue_area,
  v.address as venue_address,
  v.parking_note as venue_parking_note,
  coalesce(t.slug, s.slug) as link_slug,
  case when s.theme_id is not null then '/themes/'::text || t.slug else '/sessions/'::text || s.slug end as public_path,
  coalesce(s.legacy_format, s.session_type) is not null as is_legacy,
  case when coalesce(s.legacy_format, s.session_type) is not null then s.capacity_confirm_line
       else coalesce(s.capacity_confirm_line_override, t.capacity_confirm_line) end as capacity_confirm_line,
  case when coalesce(s.legacy_format, s.session_type) is not null then s.capacity_max
       else coalesce(s.capacity_max_override, t.capacity_max) end as capacity_max,
  s.capacity_max_male,
  s.capacity_max_female,
  s.opens_at,
  s.badge
from sessions s
  left join themes t on t.id = s.theme_id
  left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id);

-- 운영자 요청으로 세 회차 더. 시각으로 찾는다(id 는 DB 마다 다르다).
update sessions
set badge = '인기'
where start_at in (
  timestamptz '2026-09-27 15:30+09',
  timestamptz '2026-10-03 19:30+09',
  timestamptz '2026-10-04 15:30+09'
);
