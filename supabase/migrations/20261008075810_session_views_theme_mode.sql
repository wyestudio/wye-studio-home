-- 회차 뷰에 모드 칸(theme_mode) 추가 + 노말모드 테마명 정리
--
-- 적용: test 20261008075810 (적용 완료, 2026-10-08) / 운영 (미적용)
--
-- 왜
--   바-ㅇ탈출이 파티/노말 두 테마 행으로 나뉘는데, 테마명을 「바-ㅇ탈출 (노말모드)」
--   처럼 두면 상세 화면에서 모드 탭과 제목이 같은 말을 두 번 한다. 이름은
--   **두 모드 다 '바-ㅇ탈출'** 로 깨끗하게 두고, 모드는 별도 칸으로 넘긴다.
--
--   테마명을 읽는 곳이 어드민·정산·슬랙·문자로 열 군데가 넘는데, 전부 이 두 뷰를
--   거친다. 그래서 **여기 한 곳에만 칸을 더하면** 아래가 다 쓸 수 있다.
--
-- ⚠️ theme_name 은 **건드리지 않는다.** 기존 화면·템플릿이 그대로 동작해야 한다.
--    모드는 theme_mode 로 따로 받아서 쓰는 쪽이 원하는 자리에 붙인다.
-- ⚠️ 칸은 select 목록 **맨 끝**에 더한다. create or replace view 는 기존 칸의
--    순서·이름·타입이 그대로여야 하고, 뒤에 붙이는 것만 허용한다.
-- ⚠️ 모드가 없는 단독 테마는 theme_mode 가 null 이다. 화면은 null 이면 배지를
--    그리지 않는다.

-- 노말모드 테마명에서 괄호를 뗀다. 모드는 variant_label 이 들고 있다.
update themes set name = '바-ㅇ탈출'
 where slug = 'baotalchul-normal' and name = '바-ㅇ탈출 (노말모드)';

create or replace view public.session_view as
 SELECT s.id,
    s.theme_id,
    s.start_at,
    s.end_at,
    s.status,
    s.min_age,
    s.legacy_format,
    s.legacy_slug,
    t.slug AS theme_slug,
    t.name AS theme_name,
    t.difficulty,
    t.duration_minutes,
    t.accent_color,
    t.max_group_size,
    s.price_krw_override,
    ( SELECT min(p.unit_price_krw) AS min
           FROM theme_price_tiers p
          WHERE p.theme_id = t.id) AS min_unit_price_krw,
    ( SELECT max(p.unit_price_krw) AS max
           FROM theme_price_tiers p
          WHERE p.theme_id = t.id) AS max_unit_price_krw,
    COALESCE(s.capacity_confirm_line_override, t.capacity_confirm_line) AS capacity_confirm_line,
    COALESCE(s.capacity_max_override, t.capacity_max) AS capacity_max,
    COALESCE(s.venue_id_override, t.venue_id) AS venue_id,
    s.opens_at,
    s.badge,
    t.variant_label AS theme_mode
   FROM sessions s
     JOIN themes t ON t.id = s.theme_id;

create or replace view public.session_display as
 SELECT s.id,
    s.theme_id,
    s.start_at,
    s.end_at,
    s.status,
    s.min_age,
    COALESCE(t.name, s.theme_name) AS theme_name,
    COALESCE(s.legacy_format, s.session_type) AS format_label,
    COALESCE(v.area_label, s.venue_area) AS venue_area,
    v.address AS venue_address,
    v.parking_note AS venue_parking_note,
    COALESCE(t.slug, s.slug) AS link_slug,
        CASE
            WHEN s.theme_id IS NOT NULL THEN '/themes/'::text || t.slug
            ELSE '/sessions/'::text || s.slug
        END AS public_path,
    COALESCE(s.legacy_format, s.session_type) IS NOT NULL AS is_legacy,
        CASE
            WHEN COALESCE(s.legacy_format, s.session_type) IS NOT NULL THEN s.capacity_confirm_line
            ELSE COALESCE(s.capacity_confirm_line_override, t.capacity_confirm_line)
        END AS capacity_confirm_line,
        CASE
            WHEN COALESCE(s.legacy_format, s.session_type) IS NOT NULL THEN s.capacity_max
            ELSE COALESCE(s.capacity_max_override, t.capacity_max)
        END AS capacity_max,
    s.capacity_max_male,
    s.capacity_max_female,
    s.opens_at,
    s.badge,
    t.variant_label AS theme_mode
   FROM sessions s
     LEFT JOIN themes t ON t.id = s.theme_id
     LEFT JOIN venues v ON v.id = COALESCE(s.venue_id_override, t.venue_id);
