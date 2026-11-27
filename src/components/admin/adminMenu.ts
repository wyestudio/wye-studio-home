/**
 * 어드민 메뉴 목록 — 왼쪽 메뉴(AdminShell)가 쓴다. 메뉴는 이 파일 한 곳에서만 고친다.
 *
 * 구조(2026-11-27 대표님 — 관리자 개편): 맨 위 「홈」 하나, 그 아래 대분류. 대분류를 누르면
 * 소분류가 펼쳐지고 한 번에 하나만 펼친다. 소분류는 대분류마다 7개까지 — 넘으면 대분류를 나눈다.
 *
 * ⚠️ admin 서브도메인(admin.wouldyouescape.com)에서는 proxy.ts 가
 *    "/xxx" → "/admin/xxx" 로 rewrite 하므로, 링크는 /admin 접두사 없이 쓴다.
 * ⚠️ 화면이 아직 없는 메뉴는 넣지 않는다(눌러도 아무것도 없는 메뉴를 만들지 않는다).
 *    날짜 막기 · 단체 도구(설문 양식 · 안내 문자 템플릿 · 체크리스트 양식 · 플레이 리포트)는
 *    그 화면을 만드는 단계에 더한다.
 */
export type AdminMenuItem = { href: string; label: string };
export type AdminMenuGroup = { label: string; items: AdminMenuItem[] };

export const ADMIN_HOME: AdminMenuItem = { href: "/", label: "홈" };

export const ADMIN_MENU: AdminMenuGroup[] = [
  {
    label: "예약",
    items: [
      { href: "/group-bookings", label: "단체 예약" },
      { href: "/applications", label: "신청 (파티 · 노말)" },
      { href: "/sessions", label: "회차" },
    ],
  },
  {
    label: "상품",
    items: [
      { href: "/themes", label: "테마" },
      { href: "/venues", label: "장소" },
    ],
  },
  {
    label: "마케팅",
    items: [
      { href: "/promotions", label: "프로모션" },
      { href: "/coupons", label: "쿠폰" },
      { href: "/sponsorships", label: "협찬 신청" },
      { href: "/review-paybacks", label: "후기 페이백" },
      { href: "/marketing-sms", label: "광고 문자" },
      { href: "/utm", label: "유입경로 링크" },
      { href: "/settlement", label: "잼핏 정산" },
    ],
  },
  {
    // 누가 와서 무엇을 했나 — 첫 화면은 「방문 분석」, 거기서 나머지로 넘어간다(2026-11-04 대표님)
    label: "분석",
    items: [
      { href: "/insights", label: "방문 분석" },
      { href: "/visitors", label: "방문 발자취" },
      { href: "/customers", label: "고객" },
      { href: "/analytics", label: "GA4 상세" },
    ],
  },
  {
    label: "콘텐츠",
    items: [
      { href: "/content", label: "공지·FAQ" },
      { href: "/reviews", label: "후기" },
      { href: "/popups", label: "접속 팝업" },
      { href: "/season", label: "시즌 스킨" },
      { href: "/xmas-game", label: "크리스마스 게임" },
      { href: "/rankings", label: "랭킹" },
    ],
  },
  {
    // 일반 문자 템플릿은 설정에 둔다. 단체용 안내 문자는 「단체 도구」 가 생길 때 같은 화면의 탭으로 더한다(2026-11-27 대표님)
    label: "설정",
    items: [
      { href: "/sms-templates", label: "문자 템플릿" },
      { href: "/slack-templates", label: "슬랙 템플릿" },
      { href: "/audit", label: "감사로그" },
    ],
  },
];

/** 자주 쓰는 메뉴(홈 + 예약 묶음). 사이트 머리(Header)의 어드민 줄이 쓴다. */
export const ADMIN_QUICK: AdminMenuItem[] = [ADMIN_HOME, ...ADMIN_MENU[0].items];

/** 지금 화면이 이 메뉴인가. 홈("/")은 정확히 같을 때만. rewrite 전 주소(/admin/…)도 받는다. */
export function isAdminMenuActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  return href === "/" ? p === "/" : p === href || p.startsWith(`${href}/`);
}

/** 지금 화면이 속한 대분류 이름. 홈이거나 메뉴에 없는 화면이면 null. */
export function activeAdminGroup(pathname: string): string | null {
  return ADMIN_MENU.find((g) => g.items.some((i) => isAdminMenuActive(pathname, i.href)))?.label ?? null;
}

/** 지금 화면의 메뉴 이름(휴대폰 머리 줄에 쓴다). 메뉴에 없는 화면이면 null. */
export function activeAdminLabel(pathname: string): string | null {
  if (isAdminMenuActive(pathname, ADMIN_HOME.href)) return ADMIN_HOME.label;
  for (const g of ADMIN_MENU) {
    const hit = g.items.find((i) => isAdminMenuActive(pathname, i.href));
    if (hit) return hit.label;
  }
  return null;
}
