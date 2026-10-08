-- 모드 선택 창에 보여줄 한 줄 요약과 차이 항목
--
-- 적용: test 20261008132140 (적용 완료, 2026-10-08) / 운영 (미적용)
--
-- 왜
--   모드 선택을 '게임에서 모드 고르는 창' 처럼 만든다(2026-10-08 시안). 고르기
--   전에 두 모드가 **무엇이 다른지** 항목으로 보여야 하는데, 그 문구는 테마마다
--   다르고 운영자가 고친다. 코드에 박으면 테마가 늘 때마다 배포해야 한다.
--
-- ⚠️ mode_highlights 는 **배열 of {icon, label, value}** 다.
--      icon  — 화면이 아는 키만 쓴다(people/play/fun/recommend). 모르는 키는 안 그린다.
--      label — 왼쪽 작은 글씨 ('함께하는 사람')
--      value — 오른쪽 값 ('여러 팀과 함께')
--    아이콘을 자유 문자열로 두지 않는 건, 운영자가 오타를 내도 화면이 안 깨지게
--    하기 위해서다. 새 아이콘이 필요하면 화면 쪽에 키를 먼저 추가한다.
--
-- ⚠️ 강조색(accent_color)은 **모드마다 다르게** 둔다. 모드를 바꾸면 아래 전부
--    (자물쇠·태그·버튼·달력·가격표 강조)가 그 색을 따라간다 — 색만으로도 지금
--    어느 모드를 보고 있는지 알 수 있게.

alter table themes
  add column if not exists mode_summary text,
  add column if not exists mode_highlights jsonb not null default '[]'::jsonb;

comment on column themes.mode_summary is
  '모드 선택 창의 한 줄 요약. 예: 함께 겨루는 재미, 다채롭게.';
comment on column themes.mode_highlights is
  '모드 차이 항목 [{icon,label,value}]. icon 은 화면이 아는 키만(people/play/fun/recommend).';
