-- 노말모드 테마 행을 만든다 (카테고리 · 요금 구간 · 잼핏 쿠폰 허용까지)
--
-- 적용: test 20261009012347 (적용 완료, 2026-10-09) / 운영 (미적용)
--
-- 왜 마이그레이션으로 만드는가
--   지금까지 노말모드 행은 **테스트 DB 에만 손으로** 들어가 있었다. 어드민에는
--   variant_group · variant_label · min_group_size · mode_summary 같은 칸을
--   편집할 자리가 아직 없어서, 운영에서는 손으로 만들 방법조차 없다.
--   이 파일이 없으면 코드만 올라가고 **노말모드가 아예 없는 상태**가 된다.
--
-- ⚠️ id 를 적지 않는다. **이름·slug 로 찾는다.**
--    테스트와 운영의 uuid 가 다르다 — 어바웃모브는 양쪽에 있지만 id 가 서로 다르고,
--    '방탈출' 카테고리는 운영에 아예 없다(2026-10-09 실측).
--
-- ⚠️ 그림 주소는 **운영/테스트의 파티 테마 것을 그대로 가져온다.**
--    같은 아트웍이고, 무엇보다 주소에 프로젝트 ref 가 박혀 있어서 값을 적어 넣으면
--    운영이 테스트 버킷을 바라보게 된다(wye-db-release 참고).
--
-- ⚠️ 시놉시스(description)는 **비워 둔다.** 화면이 대표 모드(파티) 것을 읽어
--    두 모드가 같이 쓴다. 여기에 복사해 넣으면 두 벌이 되어 갈라진다.
--
-- ⚠️ 회차(sessions)는 만들지 않는다. 시각이 아직 안 정해졌다.
--
-- ⚠️ 여러 번 돌려도 같은 결과여야 한다.

-- 1) '방탈출' 카테고리 — 운영에는 '파티형 방탈출' 만 있다.
insert into theme_categories (name, description, sort_order)
select '방탈출',
       '한 팀이 단독으로 진행하는 일반적인 방탈출이에요. 다른 팀과 겨루지 않고 문제 풀이에만 집중합니다.',
       2
 where not exists (select 1 from theme_categories where name = '방탈출');

-- 2) 노말모드 테마 행
insert into themes (
  slug, name, difficulty, duration_minutes, genres, title_font,
  capacity_confirm_line, capacity_max, venue_id, category_id,
  hero_image_path, logo_image_path, opening_date,
  content, is_active, is_listed, is_locked, sort_order,
  accent_color, variant_group, variant_label,
  reparticipation_limit, min_group_size, recommended_group_size, max_group_size,
  mode_summary, mode_highlights
)
select
  'baotalchul-normal', '바-ㅇ탈출', 4, 100, array['문제방','아케이드'], 'galmuri11',
  24, 40, p.venue_id, (select id from theme_categories where name = '방탈출'),
  p.hero_image_path, p.logo_image_path, date '2026-09-26',
  '{"blocks": []}'::jsonb, true,
  -- 목록에 안 띄운다. 파티 테마 상세의 모드 창으로만 들어온다.
  false, false, 1,
  '#40ecff', 'baotalchul', '노말모드',
  -- null = 재참여 무제한. 팀 대항이 없어 형평성 문제가 생기지 않는다(docs/06-decisions.md D-02).
  null, 2, 4, 6,
  '우리끼리 조용히, 문제에만 집중.',
  jsonb_build_array(
    jsonb_build_object('icon','people',   'label','함께하는 사람','value','우리 팀만 단독'),
    jsonb_build_object('icon','play',     'label','플레이 방식',  'value','경쟁 없는 문제 풀이'),
    jsonb_build_object('icon','fun',      'label','즐길 거리',    'value','방탈출 한 가지에 집중'),
    jsonb_build_object('icon','recommend','label','추천 플레이',  'value','방탈출 자체를 즐기고 싶은 날')
  )
 from themes p
 where p.slug = 'baotalchul'
   and not exists (select 1 from themes where slug = 'baotalchul-normal');

-- 3) 파티 테마를 같은 묶음에 넣는다. 묶여야 모드 전환과 재참여 판정이 돈다.
update themes
   set variant_group = 'baotalchul', variant_label = '파티모드'
 where slug = 'baotalchul'
   and (variant_group is distinct from 'baotalchul' or variant_label is distinct from '파티모드');

-- 4) 요금 구간 (2인 35,000 / 3인 32,000 / 4인 이상 29,000 — 임시가)
insert into theme_price_tiers (theme_id, min_headcount, unit_price_krw)
select t.id, v.min_headcount, v.unit_price_krw
  from themes t
  cross join (values (2, 35000), (3, 32000), (4, 29000)) as v(min_headcount, unit_price_krw)
 where t.slug = 'baotalchul-normal'
   and not exists (
     select 1 from theme_price_tiers x
      where x.theme_id = t.id and x.min_headcount = v.min_headcount
   );

-- 5) 잼핏 쿠폰을 같은 묶음의 다른 모드에도 쓸 수 있게 한다.
--    ⚠️ 잼핏만이다. 계약이 '바-ㅇ탈출 테마' 에 대한 것이라 묶음 안에서만 넓힌다 —
--       applies_to_variants 는 '미래의 모든 테마' 가 아니라 **같은 variant_group**
--       만 연다(20261008071008 의 preview_coupon 참고).
--    ⚠️ 인스타 댓글 이벤트는 건드리지 않는다. 2026-10-04 에 끝난 이벤트다.
--    ⚠️ key 가 아니라 **이름**으로 찾는다 — 이 캠페인은 key 가 비어 있다(양쪽 DB 실측).
update coupon_campaigns
   set applies_to_variants = true
 where name = '잼핏 제휴 할인'
   and applies_to_variants is distinct from true;
