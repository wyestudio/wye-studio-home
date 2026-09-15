-- Phase 35 — 장소 좌표 (테마 상세 진행 장소 블록의 네이버 지도)
--
-- 적용: test 20260915160000 (적용 완료, 2026-09-15) / 운영 20260915160000 (적용 완료, 2026-09-15)
-- ⚠️ p34 다음에 적용한다 (뷰의 칸 순서가 p34 정의에 이어 붙는다).
-- 되돌리기:
--   drop view if exists theme_public_venue;
--   (p34 의 create view 로 다시 만들고 grant)
--   alter table venues drop column if exists lat, drop column if exists lng;
--
-- 페이지 안에 네이버 지도(NCP Maps · Web Dynamic Map)를 띄우려면 핀을 찍을 좌표가
-- 필요하다. 주소 → 좌표 변환(Geocoding API)은 호출마다 이용량이 잡히고 서버 키가
-- 더 필요해서, 장소를 등록할 때 어드민에서 한 번 입력해 두는 쪽을 택했다.
-- 둘 다 비어 있으면 지도 없이 주소·버튼만 보인다.

alter table venues
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- 한쪽만 들어가면 지도가 엉뚱한 곳(위도 0 등)을 찍는다. 둘 다 있거나 둘 다 없거나.
alter table venues
  drop constraint if exists venues_lat_lng_pair;
alter table venues
  add constraint venues_lat_lng_pair check (
    (lat is null and lng is null)
    or (lat between -90 and 90 and lng between -180 and 180)
  );

comment on column venues.lat is '위도. 테마 상세 진행 장소 지도의 핀 위치 (lng 와 함께 입력)';
comment on column venues.lng is '경도. 테마 상세 진행 장소 지도의 핀 위치 (lat 와 함께 입력)';

create or replace view theme_public_venue as
select
  t.id          as theme_id,
  v.area_label,
  v.parking_note,
  v.map_url,
  v.name,
  v.address,
  v.lat,
  v.lng
from themes t
join venues v on v.id = t.venue_id;

grant select on theme_public_venue to anon, authenticated, service_role;

-- 어바웃모브 좌표. 네이버 플레이스 1593924103('어바웃모브 파티룸',
-- 서울 광진구 아차산로51길 74-1 지하) 의 좌표를 2026-09-15 에 조회해 넣었다.
-- id 가 아니라 지도 링크로 찾는다(test/운영 id 가 다르다). 이미 들어 있으면 덮지 않는다.
update venues
set lat = 37.5403064, lng = 127.0851419, updated_at = now()
where map_url = 'https://naver.me/xjgcJhk6'
  and lat is null and lng is null;
