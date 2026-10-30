/**
 * 어드민 목록 → 상세 → 다시 목록으로 돌아올 때 검색 조건을 지키는 길(2026-10-30 대표님).
 *
 * 목록은 조건을 주소(?name=&sort=…)에 담는다. 상세로 갈 때 지금 목록 주소를 `back` 으로 넘기고,
 * 상세의 「← 목록」 이 그 주소로 돌아간다. 고정 주소로 돌아가면 조건이 처음으로 돌아갔다.
 */

/** 상세 주소에 돌아올 목록 주소를 붙인다. */
export function withBack(href: string, back: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}back=${encodeURIComponent(back)}`;
}

/**
 * 주소에서 받은 back 을 믿어도 되나 — 사이트 안 경로만 받는다.
 * ⚠️ 주소 값은 누구나 바꿀 수 있다. '//다른사이트' · 'https://…' 로 밖으로 보내지 못하게 막는다.
 */
export function safeBack(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || raw.length > 600) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

/** 돌아갈 곳 이름 — 링크 글자에 쓴다. */
export function backLabel(back: string): string {
  if (back.startsWith("/applications")) return "신청 목록";
  if (back.startsWith("/group-bookings")) return "단체 예약 문의";
  if (back.startsWith("/sessions")) return "회차";
  return "대시보드";
}
