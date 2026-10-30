/**
 * 어드민 메뉴 목록 — 페이지 위 메뉴 줄(AdminNav)과 사이트 머리(Header, 어드민 호스트일 때)가 같이 쓴다.
 *
 * ⚠️ admin 서브도메인(admin.wouldyouescape.com)에서는 proxy.ts 가
 *    "/xxx" → "/admin/xxx" 로 rewrite 하므로, 링크는 /admin 접두사 없이 쓴다.
 */
export const ADMIN_MENU: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "운영",
    items: [
      { href: "/", label: "대시보드" },
      { href: "/applications", label: "신청" },
      { href: "/group-bookings", label: "단체 예약 문의" },
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
      { href: "/sponsorships", label: "협찬 신청" },
      { href: "/review-paybacks", label: "후기 페이백" },
      { href: "/coupons", label: "쿠폰" },
      { href: "/marketing-sms", label: "광고 문자" },
      { href: "/settlement", label: "잼핏 정산" },
      { href: "/utm", label: "유입경로 링크" },
      { href: "/analytics", label: "분석" },
    ],
  },
  {
    label: "콘텐츠",
    items: [
      { href: "/content", label: "공지·FAQ" },
      { href: "/reviews", label: "후기" },
      { href: "/popups", label: "접속 팝업" },
      { href: "/season", label: "시즌 스킨" },
      { href: "/rankings", label: "랭킹" },
    ],
  },
  {
    label: "설정",
    items: [
      { href: "/sms-templates", label: "문자 템플릿" },
      { href: "/slack-templates", label: "슬랙 템플릿" },
      { href: "/audit", label: "감사로그" },
    ],
  },
];

/** 머리에 늘 보이는 자주 쓰는 메뉴(운영 묶음). */
export const ADMIN_QUICK = ADMIN_MENU[0].items;

/** 지금 화면이 이 메뉴인가. 대시보드("/")는 정확히 같을 때만. rewrite 전 주소(/admin/…)도 받는다. */
export function isAdminMenuActive(pathname: string, href: string): boolean {
  const p = pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  return href === "/" ? p === "/" : p === href || p.startsWith(`${href}/`);
}
