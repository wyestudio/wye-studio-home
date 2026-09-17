/**
 * 유입경로(UTM) 링크.
 *
 * 규칙은 컨플루언스 WYE-89 「SNS 채널별 UTM 파라미터 설정 및 유입 추적 검증」에
 * 있다. 값을 바꿀 일이 생기면 **문서를 먼저 고치고** 여기를 맞춘다 — 거꾸로 하면
 * 잼핏·오방 같은 외부에 이미 전달한 링크와 어긋난다.
 *
 * ⚠️ 이 모듈은 분석·홍보용이다. 신청·결제·정산 어디에도 관여하지 않는다.
 */

/**
 * 짧은 주소 목록 캐시 태그.
 *
 * ⚠️ 이 파일에는 "use client"/"server-only" 를 붙이지 않는다. 어드민 화면(클라이언트)과
 *    서버 액션·리다이렉트 라우트가 같은 규칙을 써야 하기 때문이다.
 *    실제 DB 조회는 server-only 인 `src/lib/shortLinks.ts` 에 있다.
 */
export const SHORT_LINKS_TAG = "short-links";

export type UtmLink = {
  id: string;
  label: string;
  slug: string | null;
  landing_path: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  /** 'code' 면 next.config·라우트 핸들러에 박혀 있어 이 표를 고쳐도 동작이 안 바뀐다. */
  managed_by: "db" | "code";
  status: "active" | "disabled";
  note: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
};

/**
 * WYE-89 1.1 이 정한 다섯 값.
 *
 * 여기 없는 값을 쓰면 GA4 기본 채널 그룹이 분류하지 못해 '미분류(Unassigned)' 로
 * 빠진다. 실제로 규칙 수립 이전 링크들이 profile·post·shorts·video 를 쓰고 있어
 * 같은 인스타그램 유입이 세 갈래로 갈라져 집계되고 있다(2026-09-17 확인).
 */
export const UTM_MEDIUMS: { value: string; label: string }[] = [
  { value: "social", label: "SNS (기본)" },
  { value: "paid_social", label: "SNS 유료 광고" },
  { value: "referral", label: "지역정보 등재 (네이버 플레이스 등)" },
  { value: "affiliate", label: "성과형 제휴 (잼핏)" },
  { value: "display", label: "커뮤니티 배너 광고" },
];

/** 링크의 쿼리스트링. 값이 없는 축은 붙이지 않는다. */
export function utmQuery(link: Pick<UtmLink,
  "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term">): string {
  const params = new URLSearchParams();
  params.set("utm_source", link.utm_source);
  params.set("utm_medium", link.utm_medium);
  params.set("utm_campaign", link.utm_campaign);
  if (link.utm_content) params.set("utm_content", link.utm_content);
  if (link.utm_term) params.set("utm_term", link.utm_term);
  return params.toString();
}

/** '/themes/baotalchul?utm_source=...' — 경로만. 도메인은 붙이지 않는다. */
export function utmPath(link: Parameters<typeof utmQuery>[0] & { landing_path: string }): string {
  return `${link.landing_path}?${utmQuery(link)}`;
}

/**
 * 밖에 내보내는 완성된 주소.
 *
 * 길이 제한(카카오톡 채널 홈·네이버 플레이스 100자)을 세려면 도메인까지 포함한
 * 길이를 봐야 해서 기본값을 운영 도메인으로 둔다.
 */
export const SITE_ORIGIN = "https://www.wouldyouescape.com";

export function utmUrl(
  link: Parameters<typeof utmPath>[0],
  origin: string = SITE_ORIGIN
): string {
  return `${origin}${utmPath(link)}`;
}

/**
 * 짧은 주소의 완성형. slug 가 없으면 null.
 *
 * ⚠️ 어드민에서 만드는 짧은 주소는 `/go/` 아래에 있다. 최상위에 두면 실제 페이지가
 *    없는 모든 한 칸짜리 경로를 차지해, 앞으로 페이지를 추가할 때마다 겹치는지
 *    확인해야 한다(경위는 `src/app/(site)/go/[slug]/route.ts` 주석).
 *
 * ⚠️ 이미 배포된 /open-event 와 *.go 는 코드에 박혀 있어 이 규칙과 무관하다.
 *    그 행들은 managed_by='code' 라 여기로 오지 않는다.
 */
export const SHORT_LINK_PREFIX = "/go";

export function shortUrl(
  link: { slug: string | null; managed_by?: "db" | "code" },
  origin: string = SITE_ORIGIN
): string | null {
  if (!link.slug) return null;
  // ⚠️ 코드에 박힌 짧은 주소(/open-event, *.go)는 **최상위**에 있다. 여기에도 /go/ 를
  //    붙이면 목록에 404 나는 주소가 표시되고, 운영자가 그걸 복사해 밖에 뿌리게 된다.
  //    (2026-09-17 운영 화면에서 실제로 그렇게 나왔다)
  const prefix = link.managed_by === "code" ? "" : SHORT_LINK_PREFIX;
  return `${origin}${prefix}/${link.slug}`;
}

/**
 * 100자 제한이 있는 채널.
 *
 * 카카오톡 채널 홈 버튼과 네이버 플레이스 업체정보의 홈페이지 항목이 100자를
 * 넘길 수 없다(WYE-89 2.3·2.5). 넘으면 등록 자체가 안 되므로 화면에서 경고한다.
 */
export const LENGTH_LIMIT = 100;
export const LENGTH_LIMITED_SOURCES = new Set(["kakao_channel", "naver_place"]);

export function isOverLengthLimit(link: Parameters<typeof utmPath>[0] & { utm_source: string }): boolean {
  return LENGTH_LIMITED_SOURCES.has(link.utm_source) && utmUrl(link).length > LENGTH_LIMIT;
}
