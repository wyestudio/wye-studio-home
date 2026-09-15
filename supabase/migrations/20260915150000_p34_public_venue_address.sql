-- Phase 34 — 진행 장소 상호명·주소 공개
--
-- 적용: test 20260915150000 (적용 완료, 2026-09-15) / 운영 20260915150000 (적용 완료, 2026-09-15)
-- 되돌리기:
--   ⚠️ create or replace view 로는 칸을 뺄 수 없다. drop 후 p8 의 정의로 다시 만든다.
--   drop view if exists theme_public_venue;
--   create view theme_public_venue as
--     select t.id as theme_id, v.area_label, v.parking_note, v.map_url
--     from themes t join venues v on v.id = t.venue_id;
--   grant select on theme_public_venue to anon, authenticated, service_role;
--   (2번 블록 항목은 어드민 > 테마 > 블록 편집에서 다시 추가. 지운 항목 원문 — 운영/test 동일,
--    baotalchul 테마 '참가 전 꼭 확인해주세요' 의 4번째:
--    {"title":"진행 장소는 추후 안내","desc":"정확한 참여 장소는 참여 확정 후 진행 이틀 전에 문자로 안내드립니다."})
--
-- 왜 바꾸나
--   파티룸을 대관해 진행해서, 지금까지는 '서울 건대 부근 파티룸' 까지만 보여주고
--   정확한 주소는 참여 확정자에게 진행 이틀 전 문자로만 보냈다(p8).
--   네이버 플레이스에 등록하려면 홈페이지에 상세 장소가 나와 있어야 해서
--   테마 상세 '진행 장소' 블록에 상호명·주소·지도 링크를 공개한다.
--
-- 1) theme_public_venue 에 name, address 를 더한다.
--    create or replace view 는 **맨 끝에만** 칸을 더할 수 있다 — 순서를 바꾸면 에러.
--    venues 자체에는 여전히 anon grant 를 주지 않는다(is_active·타임스탬프 등은 필요 없다).
--    ⚠️ security_invoker 는 켜지 않는다 (p8 주석 참고).

create or replace view theme_public_venue as
select
  t.id          as theme_id,
  v.area_label,
  v.parking_note,
  v.map_url,
  v.name,
  v.address
from themes t
join venues v on v.id = t.venue_id;

comment on view theme_public_venue is
  '테마 상세 진행 장소 블록용 공개 장소 정보. 2026-09-15(p34)부터 상호명·주소도 공개한다(네이버 플레이스 등록).';

grant select on theme_public_venue to anon, authenticated, service_role;

-- 2) '참가 전 꼭 확인해주세요' 의 '진행 장소는 추후 안내' 항목을 뺀다.
--    바로 위 진행 장소 블록에 주소가 나오는데 '추후 안내' 라고 하면 서로 어긋난다.
--
--    ⚠️ 배열 인덱스로 찍지 않는다(p8 과 같은 이유 — 어드민에서 순서를 바꾼다).
--       항목 제목으로 찾아 걸러낸다. 나머지 항목 순서는 ordinality 로 보존한다.
update themes
set content = jsonb_set(
      content,
      '{blocks}',
      (
        select jsonb_agg(
                 case
                   when b->>'type' = 'callout' then
                     jsonb_set(
                       b,
                       '{items}',
                       (
                         select coalesce(jsonb_agg(i order by io), '[]'::jsonb)
                         from jsonb_array_elements(b->'items') with ordinality as x(i, io)
                         where i->>'title' is distinct from '진행 장소는 추후 안내'
                       )
                     )
                   else b
                 end
                 order by bo
               )
        from jsonb_array_elements(content->'blocks') with ordinality as y(b, bo)
      )
    ),
    updated_at = now()
where content::text like '%진행 장소는 추후 안내%';
