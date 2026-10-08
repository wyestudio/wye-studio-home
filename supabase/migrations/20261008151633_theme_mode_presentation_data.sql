-- 바-ㅇ탈출 두 모드의 '보여줄 내용' 을 파일로 남긴다
--
-- 적용: test 20261008151707 (적용 완료, 2026-10-09) / 운영 (미적용)
--
-- 왜 데이터를 마이그레이션에 넣는가
--   앞 마이그레이션(20261008132112)은 **칸만** 만들었고, 값은 테스트 DB 에 손으로
--   넣었다. 그러면 운영에 올릴 때 칸만 생기고 **화면이 통째로 비어 나간다** —
--   모드 요약도, 차이 항목도, 모드별 강조색도 없다.
--   어드민에 이 칸들을 편집할 자리가 아직 없어서, 손으로 다시 넣을 방법도 없다.
--
-- ⚠️ slug 로 찾아 UPDATE 만 한다. 행을 만들지 않는다 — 노말 테마 행을 만드는 일은
--    별도다(가격·장소·회차까지 딸려 있다).
-- ⚠️ 여러 번 돌려도 같은 결과여야 한다. 배포 중 재실행될 수 있다.
--
-- ⚠️ 강조색을 왜 이 둘로 골랐나 (2026-10-09)
--      화면 하나에서 색이 맡는 역할은 둘뿐이다 — 모드(민트/시안)와 할인(노랑).
--      나머지(단체·상태)는 무채색이거나 이 화면에 안 나온다.
--      노말은 처음에 분홍(#ffa6d9)이었는데 **단체 안내 페이지의 자홍(#f082f4)과
--      ΔE 34, 위험색(#ff6b6b)과 ΔE 47** 로 가까웠다. 분홍 화면에서 단체를 누르면
--      또 분홍 페이지가 나와서 "여기가 노말모드인가" 싶어진다.
--      시안(#40ecff)은 사이트의 **모든** 고정색과 ΔE 49 이상 떨어져 있다(가장
--      가까운 것이 마스코트 블루). 노랑~빨강은 얼리버드·대기·위험이, 파랑~보라는
--      브랜드·글로우가 이미 쓰고 있어서 비어 있는 자리가 여기뿐이었다.
--      ⚠️ 새 색을 더하기 전에 globals.css 의 고정색들과 먼저 재 볼 것.

update themes set
  accent_color = '#3dffb0',
  mode_summary = '함께 겨루는 재미, 다채롭게.',
  mode_highlights = jsonb_build_array(
    jsonb_build_object('icon','people',   'label','함께하는 사람','value','여러 팀과 함께'),
    jsonb_build_object('icon','play',     'label','플레이 방식',  'value','팀 대항 경쟁'),
    jsonb_build_object('icon','fun',      'label','즐길 거리',    'value','방탈출 + 미니게임'),
    jsonb_build_object('icon','recommend','label','추천 플레이',  'value','게임도 모임도 즐기고 싶은 날')
  )
 where slug = 'baotalchul';

update themes set
  accent_color = '#40ecff',
  mode_summary = '우리끼리 조용히, 문제에만 집중.',
  mode_highlights = jsonb_build_array(
    jsonb_build_object('icon','people',   'label','함께하는 사람','value','우리 팀만 단독'),
    jsonb_build_object('icon','play',     'label','플레이 방식',  'value','경쟁 없는 문제 풀이'),
    jsonb_build_object('icon','fun',      'label','즐길 거리',    'value','방탈출 한 가지에 집중'),
    jsonb_build_object('icon','recommend','label','추천 플레이',  'value','방탈출 자체를 즐기고 싶은 날')
  )
 where slug = 'baotalchul-normal';
