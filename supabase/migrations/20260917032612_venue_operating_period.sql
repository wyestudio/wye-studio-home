-- 장소 운영기간 (테마 상세 '진행 장소' 블록에 공개)
--
-- 적용: test 20260917032612 (적용 완료, 2026-09-17) / 운영 (미적용)
-- 되돌리기:
--   drop view if exists theme_public_venue;
--   (20260915160000_p35_venue_coordinates.sql 의 create view 로 다시 만들고 grant)
--   alter table venues drop column if exists operating_period;
--
-- 네이버 스마트플레이스 '팝업스토어' 등록이 보류됐다(2026-09-17).
--   보류사유   : 팝업스토어 - 공식 확인이 필요한 업체 정보
--   등록가능요건: 팝업행사 정보 항목 내 팝업스토어 **운영기간 설정 필요, 종료일 미정 설정 불가**
--   조회기관   : 브랜드 공식 홈페이지
-- 심사는 사람이 홈페이지를 열어 눈으로 확인하므로, 숨긴 글자(display:none)로는 통과하지
-- 못한다. 그래서 화면에 보이는 값으로 둔다.
--
-- ⚠️ 이 값은 '해당 장소에서 진행하는 기간' 이지 우주이스케이프의 운영 종료일이 아니다.
--    고객이 브랜드가 끝나는 걸로 오해하지 않도록 화면에서는 안내 한 줄과 함께 보여준다
--    (src/components/contents/VenueCard.tsx).

alter table venues
  add column if not exists operating_period text;

comment on column venues.operating_period is
  '이 장소에서의 운영기간 표기(예: 2026.09.26 ~ 2027.03.25). 테마 상세 진행 장소에 공개. 비우면 안 보인다. 네이버 스마트플레이스 팝업스토어 등록 요건(종료일 명시)';

create or replace view theme_public_venue as
select
  t.id          as theme_id,
  v.area_label,
  v.parking_note,
  v.map_url,
  v.name,
  v.address,
  v.lat,
  v.lng,
  v.operating_period
from themes t
join venues v on v.id = t.venue_id;

comment on view theme_public_venue is
  '테마 상세에 노출해도 되는 장소 정보. 상호명·정확 주소·좌표·운영기간까지 공개(네이버 플레이스 등록 요건).';

grant select on theme_public_venue to anon, authenticated, service_role;

-- 어바웃모브 운영기간. id 가 아니라 지도 링크로 찾는다(test/운영 id 가 다르다).
-- 이미 값이 있으면 덮지 않는다.
update venues
set operating_period = '2026.09.26 ~ 2027.03.25', updated_at = now()
where map_url = 'https://naver.me/xjgcJhk6'
  and operating_period is null;
