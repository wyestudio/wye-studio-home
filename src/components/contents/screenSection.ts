/**
 * '한 화면에 블록 하나' 배치.
 *
 * 테마 상세 첫 화면(소개)을 화면 높이만큼 채우고 가운데보다 살짝 위에 띄웠더니,
 * 다음 블록이 같이 보이지 않아 집중이 잘 되고 덜 피곤하다는 의견(2026-09-15).
 * 상세 블록·날짜 선택에도 똑같이 쓴다.
 *
 * - 높이는 **최소값**이다. 내용이 한 화면보다 길면(후기·주의사항 등) 그만큼 길어진다.
 * - pb 를 pt 보다 크게 줘서 가운데보다 위로 올린다.
 * - 화면 높이에서 헤더(모바일은 헤더 + 섹션 이동 탭)를 뺀다.
 * - 모바일은 한 화면을 다 채우지 않는다(최소 72%). 손가락으로 밀어 내리는데 블록마다
 *   빈 여백이 한 화면씩 끼면 스크롤이 힘들다는 의견(2026-09-15). 휠 넘기기도 모바일엔 없다.
 *
 * ⚠️ 헤더 높이를 --header-height 로 빼지 않는다. 그 값은 React 가 뜬 뒤에 들어와서
 *    들어오는 순간 블록이 위아래로 한 번 움직인다. 헤더(Header.tsx) 크기를 바꾸면
 *    여기 숫자도 같이 고친다 — 지금 데스크톱 헤더 약 100px, 모바일 헤더 약 64px + 탭 46px.
 * ⚠️ Tailwind 가 소스에서 클래스 이름을 찾으므로 문자열을 조립하지 말고 통째로 둔다.
 */
/**
 * 첫 화면(테마 소개) 전용. 모바일에서도 화면을 다 채운다 — 첫 화면에는 소개만 보이고
 * 아래 회차 선택이 비쳐 보이지 않게 하려는 것이라, 모바일 여백 줄이기(아래)에서 뺐다.
 */
export const INTRO_SCREEN_SECTION =
  "flex min-h-[calc(100svh-7rem)] flex-col justify-center pt-6 pb-[8svh] md:min-h-[calc(100svh-6.25rem)] md:pt-8 md:pb-[10svh]";

/** 이 섹션으로 스크롤해 올 때 헤더 밑에 딱 붙게 하는 여백. 섹션이 화면을 정확히 채운다. */
export const SCREEN_SCROLL_MARGIN = "scroll-mt-[7rem] md:scroll-mt-[6.25rem]";

export const SCREEN_SECTION =
  "flex min-h-[72svh] flex-col justify-center pt-6 pb-[5svh] md:min-h-[calc(100svh-6.25rem)] md:pt-8 md:pb-[10svh]";
