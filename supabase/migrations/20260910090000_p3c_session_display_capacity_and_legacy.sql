-- session_display 에 실효 정원 추가 + 옛 회차 판정 기준 변경
--
-- 적용: test 적용 완료 (2026-09-10) / ⚠️ 운영 미적용
--
-- 되돌리기: 20260910065306_p3_session_display_view.sql 의 정의로 재생성.
--
-- 배경 1 — 어드민 회차 카드가 sessions 의 옛 컬럼을 직접 읽고 있었다:
--   · 신규 회차인데 "정원: 50명" (옛 회차 값)
--   · 소개팅 시절의 "확정: 남 0 · 여 0" 이 계속 표시
--   · 제목(theme_name)과 링크(slug)가 비어 빈칸 / '/sessions/null'
--
-- 배경 2 — 옛 회차 판정을 theme_id 로 하면 Phase 2 이관 직후 무너진다.
--   이관으로 옛 회차에도 theme_id 가 생기기 때문. 그러면 8/29 소개팅 정원이
--   당시 실제 값(남30·여30, 총60)이 아니라 지금 테마 값(40)으로 표시된다.
--   legacy_format / session_type 은 옛 회차에만 있고 이관해도 안 바뀌므로
--   이쪽을 표식으로 쓴다.
--
-- ⚠️ 새 컬럼은 반드시 뒤에 붙인다. create or replace view 는 컬럼 순서·이름을
--    바꾸지 못한다(중간에 끼우면 42P16). 순서를 바꾸려면 drop 이 필요하다.

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
       else '/sessions/' || s.slug end        as public_path,
  (coalesce(s.legacy_format, s.session_type) is not null) as is_legacy,
  -- 옛 회차는 당시 값, 신규 회차는 회차 override → 테마 값.
  case when coalesce(s.legacy_format, s.session_type) is not null
       then s.capacity_confirm_line
       else coalesce(s.capacity_confirm_line_override, t.capacity_confirm_line)
  end                                         as capacity_confirm_line,
  case when coalesce(s.legacy_format, s.session_type) is not null
       then s.capacity_max
       else coalesce(s.capacity_max_override, t.capacity_max)
  end                                         as capacity_max,
  -- 성별 정원은 옛 소개팅 회차에만 값이 있다. 신규는 null 이라 화면이 분기할 수 있다.
  s.capacity_max_male,
  s.capacity_max_female
from sessions s
left join themes t on t.id = s.theme_id
left join venues v on v.id = coalesce(s.venue_id_override, t.venue_id);

comment on view session_display is
  '옛 회차와 새 회차의 표시값을 통일한 뷰. session_view 와 달리 LEFT JOIN 이라 theme_id 가 없는 과거 회차도 포함한다. 옛 회차 판정은 format_label(legacy_format/session_type) 유무로 한다 — 이관 후에도 안정적이다. 어드민 화면은 sessions 를 직접 읽지 말고 이 뷰를 쓸 것.';

grant select on session_display to service_role;
