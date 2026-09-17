-- 이벤트 말풍선이 켜진 동안 우하단 인스타 버튼이 이벤트 게시물로 가게 한다
--
-- 적용: test (2026-09-17 적용·이력 기록) / 운영 (미적용)
-- 되돌리기:
--   (public_event_bubble 을 url 칸 없이 이전 정의로 되돌리려면 drop view 후 p42 정의로 create)
--   alter table coupon_campaigns drop column if exists event_bubble_url;
--
-- 말풍선이 알리는 게 인스타 쿠폰 이벤트인데, 눌러서 간 곳이 계정 홈이면 게시물을 다시
-- 찾아야 한다(2026-09-17 요청). 말풍선을 끄면 버튼은 다시 계정 홈으로 간다.
-- ⚠️ 코드는 url 칸이 없어도 말풍선을 띄운다(select *) — 운영 적용 순서가 어긋나도 500 이 안 난다.

alter table coupon_campaigns add column if not exists event_bubble_url text;

comment on column coupon_campaigns.event_bubble_url is
  '말풍선이 켜진 동안 우하단 인스타 버튼·말풍선이 향할 주소(이벤트 게시물). 비우면 계정 홈.';

-- ⚠️ create or replace 는 맨 끝에만 칸을 더할 수 있다.
create or replace view public_event_bubble as
select coalesce(nullif(btrim(c.event_bubble_text), ''), c.name) as text,
  nullif(btrim(c.event_bubble_url), '') as url
from coupon_campaigns c
where c.is_active
  and c.show_event_bubble
  and (c.valid_from is null or c.valid_from <= now())
  and (c.valid_until is null or c.valid_until >= now())
order by c.updated_at desc
limit 1;

-- 지금 켜져 있는 인스타 댓글 이벤트에 게시물을 붙인다. id 가 DB 마다 달라 key 로 찾는다.
update coupon_campaigns
set event_bubble_url = 'https://www.instagram.com/p/DdWLDjOzN0y/'
where key = 'instagram_grand_open_202609' and event_bubble_url is null;
