/**
 * GA4 가 주는 영어 코드값을 운영자가 읽을 수 있는 한국어로 바꾼다.
 *
 * 분석 화면이 "죽은 페이지" 로 느껴진 이유 중 하나가 이것이었다 —
 * `(not set)`, `jeonbang_app / display`, `/themes/baotalchul` 처럼
 * **읽어도 뜻을 모르는 값**만 나열돼 있었다. 숫자보다 먼저 "이게 뭔지" 가
 * 보여야 한다.
 *
 * ⚠️ 모르는 값은 원문을 그대로 남긴다. 억지로 번역해서 틀린 이름을 붙이면
 *    없느니만 못하다.
 */

/** source/medium 조합 중 뜻이 정해진 것들. 왼쪽은 GA4 원문(소문자 비교). */
const SOURCE_NAMES: { match: (source: string, medium: string) => boolean; label: string }[] = [
  { match: (s) => s === "(direct)", label: "직접 방문" },
  { match: (s) => s.includes("instagram"), label: "인스타그램" },
  { match: (s) => s.includes("naver"), label: "네이버" },
  { match: (s) => s.includes("google"), label: "구글" },
  { match: (s) => s.includes("daum") || s.includes("kakao"), label: "카카오·다음" },
  { match: (s) => s.includes("jeonbang"), label: "전방(방탈출 앱)" },
  { match: (s) => s.includes("facebook"), label: "페이스북" },
  { match: (s) => s.includes("youtube"), label: "유튜브" },
  { match: (s) => s.includes("threads"), label: "스레드" },
  { match: (s) => s.includes("localhost") || s.includes("vercel.app"), label: "내부 테스트" },
];

/** medium(매체) 설명. 같은 인스타그램이라도 게시물인지 프로필 링크인지 다르다. */
const MEDIUM_NAMES: Record<string, string> = {
  "(none)": "",
  organic: "검색",
  referral: "링크 타고",
  social: "소셜",
  display: "광고",
  cpc: "검색광고",
  post: "게시물",
  profile: "프로필 링크",
  story: "스토리",
  email: "메일",
  sms: "문자",
};

/**
 * 'instagram / post' → '인스타그램 · 게시물'
 * '(not set)'        → '출처 불명'
 */
export function sourceLabel(raw: string): string {
  const lower = raw.toLowerCase().trim();

  if (lower === "(not set)") return "출처 불명";
  if (lower === "(data not available)") return "수집 안 됨";
  if (lower === "직접") return "직접 방문";

  const [sourceRaw, mediumRaw = ""] = lower.split("/").map((x) => x.trim());
  const named = SOURCE_NAMES.find((n) => n.match(sourceRaw, mediumRaw));
  const source = named?.label ?? sourceRaw;
  const medium = MEDIUM_NAMES[mediumRaw];

  if (medium === undefined) return mediumRaw ? `${source} · ${mediumRaw}` : source;
  return medium ? `${source} · ${medium}` : source;
}

/** 출처를 모르는 값인가. 요약 문장에서 1위로 뽑으면 안 되는 것들. */
export function isUnknownSource(raw: string): boolean {
  const lower = raw.toLowerCase().trim();
  return lower === "(not set)" || lower === "(data not available)";
}

/**
 * '/themes/baotalchul' → '테마 상세'
 *
 * 테마 slug 까지 읽어 이름을 붙이지는 않는다 — 테마가 늘면 화면에서 slug 를
 * 알아볼 수 없게 되므로, 경로는 그대로 작게 같이 보여준다(화면 쪽 처리).
 */
export function pathLabel(raw: string): string {
  const path = (raw || "/").split("?")[0];

  if (path === "/" || path === "직접") return "홈";
  if (path === "(not set)") return "경로 불명";
  if (path === "(data not available)") return "수집 안 됨";
  // 어드민 로그인. 어드민 서브도메인은 rewrite 때문에 /admin 접두사 없이 찍힌다.
  if (path === "/login" || path.startsWith("/admin/login")) return "어드민 로그인";
  if (path === "/contents") return "컨텐츠 목록";
  if (path === "/notice") return "공지·FAQ";
  if (path === "/about") return "소개";
  if (path === "/lookup") return "신청내역 조회";
  if (path === "/lookup/result") return "신청내역 조회 결과";
  if (path === "/terms") return "이용약관";
  if (path === "/privacy") return "개인정보처리방침";
  if (path.startsWith("/c/")) return "쿠폰 링크";
  if (path.endsWith("/apply")) return "신청 폼";
  if (path.startsWith("/themes/")) return "테마 상세";
  if (path.startsWith("/sessions/")) return "옛 회차 페이지";
  // 어드민은 이제 집계되지 않지만, 지난 기간을 조회하면 여전히 남아 있다.
  if (
    path.startsWith("/admin") ||
    ["/applications", "/sessions", "/themes", "/venues", "/coupons", "/analytics", "/audit"].includes(path)
  )
    return "어드민 화면";
  return path;
}
