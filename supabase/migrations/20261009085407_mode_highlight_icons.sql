-- 모드마다 다른 아이콘을 쓴다
--
-- 적용: test 20261009085502 (적용 완료, 2026-10-09) / 운영 (미적용)
--
-- 왜
--   두 모드가 같은 아이콘 네 개(people/play/fun/recommend)를 쓰고 글자만 달랐다.
--   모드를 바꿔도 **바뀐 느낌이 안 난다**(2026-10-09 대표님).
--     파티 users · swords · gamepad · sparkles   — 여럿이 겨루는 쪽
--     노말 person · handshake · puzzle · focus    — 우리끼리 푸는 쪽
--
-- ⚠️ 키 이름을 **역할(people/play/fun)에서 그림 이름(users/swords/gamepad)으로**
--    바꾼다. 역할로 두면 "모드마다 다른 그림" 을 적을 수가 없다 — 같은 역할 줄에
--    서로 다른 그림을 넣는 게 목적이기 때문이다.
--
-- ⚠️ 화면(ModeBox 의 ModeIcon)이 **아는 키만** 그린다. 여기 없는 키를 적으면
--    아이콘 없이 글자만 나온다 — 화면이 깨지지는 않지만 비어 보인다.
--    새 그림이 필요하면 ModeIcon 에 먼저 추가할 것.

update themes set
  mode_highlights = jsonb_build_array(
    jsonb_build_object('icon','users',    'label','함께하는 사람','value','여러 팀과 함께'),
    jsonb_build_object('icon','swords',   'label','플레이 방식',  'value','팀 대항 경쟁'),
    jsonb_build_object('icon','gamepad',  'label','즐길 거리',    'value','방탈출 + 미니게임'),
    jsonb_build_object('icon','sparkles', 'label','추천 플레이',  'value','게임도 모임도 즐기고 싶은 날')
  )
 where slug = 'baotalchul';

update themes set
  mode_highlights = jsonb_build_array(
    jsonb_build_object('icon','person',   'label','함께하는 사람','value','우리 팀만 단독'),
    jsonb_build_object('icon','handshake','label','플레이 방식',  'value','경쟁 없는 문제 풀이'),
    jsonb_build_object('icon','puzzle',   'label','즐길 거리',    'value','방탈출 한 가지에 집중'),
    jsonb_build_object('icon','focus',    'label','추천 플레이',  'value','방탈출 자체를 즐기고 싶은 날')
  )
 where slug = 'baotalchul-normal';
