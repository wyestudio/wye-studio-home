-- Phase 42 — 회차 인기 태그 + 이벤트 말풍선을 쿠폰 캠페인에 붙이기
--
-- 적용: test (미적용) / 운영 (미적용)
-- 되돌리기:
--   alter table sessions drop column if exists badge;
--   alter table coupon_campaigns drop column if exists show_event_bubble, drop column if exists event_bubble_text;
--   drop view if exists public_event_bubble;
--   (session_view 는 p42 이전 정의로 create or replace)
--
-- 1) 회차 태그(sessions.badge)
--    회차가 많이 열려 있으니 "아무도 신청 안 한 건가?" 싶어 망설인다는 의견(2026-09-16).
--    쇼핑몰 상품 목록의 'BEST' 처럼 붙이는 짧은 표시다. 글자를 그대로 쓰므로
--    '인기' 말고 '마감임박' 같은 말도 넣을 수 있다. 비우면 안 나온다.

alter table sessions add column if not exists badge text;
comment on column sessions.badge is
  '회차 시각 옆에 붙는 짧은 표시(예: 인기). 비우면 안 나온다.';

-- session_view 에 badge 를 흘려보낸다. ⚠️ create or replace 는 맨 끝에만 칸을 더할 수 있다.
create or replace view session_view as
select s.id,
  s.theme_id,
  s.start_at,
  s.end_at,
  s.status,
  s.min_age,
  s.legacy_format,
  s.legacy_slug,
  t.slug as theme_slug,
  t.name as theme_name,
  t.difficulty,
  t.duration_minutes,
  t.accent_color,
  t.max_group_size,
  s.price_krw_override,
  (select min(p.unit_price_krw) from theme_price_tiers p where p.theme_id = t.id) as min_unit_price_krw,
  (select max(p.unit_price_krw) from theme_price_tiers p where p.theme_id = t.id) as max_unit_price_krw,
  coalesce(s.capacity_confirm_line_override, t.capacity_confirm_line) as capacity_confirm_line,
  coalesce(s.capacity_max_override, t.capacity_max) as capacity_max,
  coalesce(s.venue_id_override, t.venue_id) as venue_id,
  s.opens_at,
  s.badge
from sessions s
join themes t on t.id = s.theme_id;

-- 9/26 15:30·19:30 두 회차에 먼저 달아 둔다(운영자 요청). 시각으로 찾는다 — id 가 DB 마다 다르다.
update sessions
set badge = '인기'
where start_at in (timestamptz '2026-09-26 15:30+09', timestamptz '2026-09-26 19:30+09');

-- 2) 이벤트 말풍선을 쿠폰 캠페인에 붙인다
--    말풍선이 가리키는 게 결국 '인스타 쿠폰 이벤트' 라서, 쿠폰을 만들고 끄는 자리에서
--    같이 켜고 끄는 게 맞다는 요청(2026-09-16). 설정을 두 곳에 두지 않으려고
--    p41 에서 만든 site_settings 쪽 말풍선 설정은 되돌린다(아래 4번).

alter table coupon_campaigns
  add column if not exists show_event_bubble boolean not null default false,
  add column if not exists event_bubble_text text;

comment on column coupon_campaigns.show_event_bubble is
  '켜면 사이트 우하단 인스타 버튼 위에 이벤트 말풍선이 뜬다. 캠페인이 꺼지거나 기간이 지나면 같이 사라진다.';
comment on column coupon_campaigns.event_bubble_text is
  '말풍선 문구. 줄바꿈하면 두 줄로 보인다. 비우면 캠페인 이름을 쓴다.';

-- 3) 고객 화면이 읽을 것만 추린 뷰.
--    ⚠️ coupon_campaigns 를 직접 열지 않는다 — 할인율·발급 조건까지 다 드러난다.
--    ⚠️ security_invoker 를 켜지 않는다(소유자 권한으로 돌아야 RLS 를 통과한다).
create or replace view public_event_bubble as
select coalesce(nullif(btrim(c.event_bubble_text), ''), c.name) as text
from coupon_campaigns c
where c.is_active
  and c.show_event_bubble
  and (c.valid_from is null or c.valid_from <= now())
  and (c.valid_until is null or c.valid_until >= now())
order by c.updated_at desc
limit 1;

comment on view public_event_bubble is
  '우하단 이벤트 말풍선 문구. 켜진 쿠폰 캠페인이 없으면 0행이고 말풍선도 안 뜬다.';

grant select on public_event_bubble to anon, authenticated, service_role;

-- 4) p41(site_settings 공개 읽기)은 되돌린다. 말풍선 설정이 쿠폰으로 옮겨가 쓰이지 않는다.
delete from site_settings where key = 'public.event_bubble';
drop policy if exists site_settings_public_read on site_settings;
revoke select on site_settings from anon, authenticated;
