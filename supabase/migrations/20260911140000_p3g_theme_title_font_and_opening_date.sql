-- 테마별 제목 글꼴 + 정식 오픈일.
--
-- 적용: test 적용 완료 (2026-09-11) / ⚠️ 운영 미적용
-- 되돌리기:
--   alter table public.themes drop column if exists title_font;
--   alter table public.themes drop column if exists opening_date;
--
-- title_font  : 컨텐츠 목록의 테마명에만 쓰는 글꼴 키(현재 '' 또는 'galmuri11').
--               테마마다 분위기가 달라서(바-ㅇ탈출은 8비트 도트 게임) 코드에
--               박지 않고 어드민에서 고르게 한다.
-- opening_date: 예약 달력에서 '오픈' 으로 표시할 날짜. 정식 오픈을 알리는 표시라
--               테마마다 다르고 한 번 지나면 비우면 된다.

alter table public.themes
  add column if not exists title_font text,
  add column if not exists opening_date date;

comment on column public.themes.title_font is
  '컨텐츠 목록 테마명 글꼴 키. THEME_TITLE_FONTS(src/types/catalog.ts) 와 값이 맞아야 한다.';
comment on column public.themes.opening_date is
  '예약 달력에 ''오픈'' 으로 표시할 날짜. 비우면 표시 안 함.';
