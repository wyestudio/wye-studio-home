/**
 * 단체 예약(10~24명) 전용 페이지에서 쓰는 값들.
 *
 * 왜 한 파일에 모으는가
 *   선택지 문구는 **화면(폼) · API 검증 · 어드민 목록** 세 곳에서 같이 읽힌다.
 *   세 곳에 따로 적으면 "화면에는 있는데 제출하면 거부" 가 되거나, 어드민 목록에
 *   코드값(`weekday_evening`)이 그대로 찍힌다.
 *
 * ⚠️ 이 파일은 `"use client"` 폼이 import 한다 — 감출 값을 적지 않는다.
 *    여기 있는 것은 전부 화면에 그대로 보이는 문구다.
 */

/** 단체 예약 안내 페이지 주소. 상세 페이지의 연결이 전부 이 값을 쓴다. */
export const GROUP_BOOKING_PATH = "/group";

/**
 * GA4 의 `theme_label` 칸에 넣는 이 페이지 이름.
 *
 * 테마 상세는 거기에 테마명(`바-ㅇ탈출`)을 넣는다. 이 페이지는 테마가 없지만 같은
 * 칸을 비워 두면 GA4 에서 "(not set)" 으로 섞여, 어느 화면의 블록 열람인지 못
 * 가른다. 상품이 아니라 **화면 이름**을 넣는다.
 */
export const GROUP_PAGE_LABEL = "단체 예약 안내";

/**
 * 단체 예약 강조색.
 *
 * ⚠️ **단체로 가는 길은 전부 이 색이다** — 상세의 PRIVATE ROOM 패널 · 가격표 아래
 *    카드 · 본문 속 링크, 그리고 도착지인 /group 까지. 색이 갈리면 같은 곳으로
 *    간다는 게 안 보인다.
 * ⚠️ 모드 강조색(파티 민트 · 노말 시안)과는 멀리 떨어져 있어야 한다. 노말이
 *    분홍이던 때는 ΔE 34 라 모드색의 일부로 읽혔다 — 모드색을 바꿀 일이 있으면
 *    이 색과의 거리를 먼저 재 볼 것.
 *
 * ⚠️ Tailwind 클래스(`bg-[#f082f4]`)는 **소스에 적힌 문자열을 훑어** 만들어진다.
 *    이 상수로 클래스 이름을 조립하면 그 클래스가 생성되지 않는다. 클래스는 literal
 *    로 적고, 이 값은 inline style 이나 SVG stroke 처럼 런타임 값에만 쓴다.
 */
export const GROUP_ACCENT = "#f082f4";

/**
 * 단체 예약 링크를 띄울 테마.
 *
 * ⚠️ 안내 페이지 내용(3시간 · 10~24명 · 단독 진행 · 광진구)이 이 테마 기준이라,
 *    다른 테마에 링크가 붙으면 **우리가 팔지 않는 조건을 안내하는 꼴**이 된다.
 *    단체 예약을 받는 테마가 늘면 여기에 slug 를 더한다.
 */
export const GROUP_BOOKING_THEME_SLUGS: readonly string[] = ["baotalchul"];

export function hasGroupBooking(themeSlug: string): boolean {
  return GROUP_BOOKING_THEME_SLUGS.includes(themeSlug);
}

/** 단체 예약으로 받는 인원. 화면 문구·폼 검증·API 검증이 같이 쓴다. */
export const GROUP_HEADCOUNT_MIN = 10;
export const GROUP_HEADCOUNT_MAX = 24;

/**
 * 연락 수단. 코드는 DB 제약(`contact_method`)에 박혀 있어 **바꾸면 마이그레이션이
 * 필요하다.** 라벨만 바꾸는 건 자유다.
 */
export const CONTACT_METHODS = [
  { code: "kakao", label: "카카오톡" },
  { code: "phone", label: "전화" },
  { code: "sms", label: "문자" },
  { code: "email", label: "이메일" },
] as const;

export type ContactMethodCode = (typeof CONTACT_METHODS)[number]["code"];

/** 희망 시간대. DB 에 제약이 없으므로 선택지는 여기서만 늘리면 된다. */
export const PREFERRED_TIMES = [
  { code: "t1130", label: "11:30" },
  { code: "t1530", label: "15:30" },
  { code: "t1930", label: "19:30" },
  { code: "weekday_evening", label: "평일 저녁" },
  { code: "flexible", label: "협의 희망" },
] as const;

/** 모임 성격. 상담할 때 레크리에이션을 맞추는 기준이라 받아 둔다. */
export const GROUP_KINDS = [
  { code: "escape", label: "방탈출 모임" },
  { code: "boardgame", label: "보드게임 모임" },
  { code: "friends", label: "지인 모임" },
  { code: "company", label: "회사 워크숍" },
  { code: "school", label: "학교·동아리" },
  { code: "church", label: "교회" },
  { code: "etc", label: "기타" },
] as const;

/** 코드 → 화면 문구. 모르는 코드는 코드 그대로 보여준다(옛 접수분이 섞일 수 있다). */
function labelOf(options: readonly { code: string; label: string }[], code: string): string {
  return options.find((o) => o.code === code)?.label ?? code;
}

export const contactMethodLabel = (code: string) => labelOf(CONTACT_METHODS, code);
export const preferredTimeLabel = (code: string) => labelOf(PREFERRED_TIMES, code);
export const groupKindLabel = (code: string) => labelOf(GROUP_KINDS, code);

export function isContactMethod(code: string): code is ContactMethodCode {
  return CONTACT_METHODS.some((o) => o.code === code);
}
export const isPreferredTime = (code: string) => PREFERRED_TIMES.some((o) => o.code === code);
export const isGroupKind = (code: string) => GROUP_KINDS.some((o) => o.code === code);

/**
 * 접수 상태. 접수함이지 예약이 아니므로 '확정'까지 가는 단계를 여기서 센다.
 * 코드는 DB 제약(`status`)에 박혀 있다.
 */
export const INQUIRY_STATUSES = [
  { code: "new", label: "접수" },
  { code: "contacted", label: "연락 완료" },
  { code: "quoted", label: "견적 안내" },
  { code: "booked", label: "예약 확정" },
  { code: "dropped", label: "무응답·취소" },
] as const;

export type InquiryStatusCode = (typeof INQUIRY_STATUSES)[number]["code"];

export const inquiryStatusLabel = (code: string) => labelOf(INQUIRY_STATUSES, code);
export function isInquiryStatus(code: string): code is InquiryStatusCode {
  return INQUIRY_STATUSES.some((o) => o.code === code);
}

/**
 * 상세 페이지에서 단체 예약 페이지로 들어온 **진입 지점**.
 *
 * 어느 자리의 링크가 실제로 눌리는지 모르면 자리를 늘릴지 줄일지 판단할 수
 * 없다. GA4 의 `section_key` 칸에 이 값이 들어간다(analytics.ts 의 GROUP_EVENT).
 */
export const GROUP_ENTRY = {
  /** 상세 첫 화면, 모드 선택 창 옆의 PRIVATE ROOM 패널 */
  intro: "detail_intro",
  /** 상세 PRICE 섹션 아래 안내 카드 */
  price: "detail_price",
  /** 신청 1단계 인원 선택 아래 한 줄 */
  applyStep1: "apply_step1",
  /** 상세 FAQ 항목 안의 링크 */
  faq: "detail_faq",
  /** 상세 FOR YOU 4번째 카드 안의 링크 */
  forYou: "detail_for_you",
} as const;

export type GroupEntryKey = (typeof GROUP_ENTRY)[keyof typeof GROUP_ENTRY];

export function isGroupEntry(v: string): v is GroupEntryKey {
  return (Object.values(GROUP_ENTRY) as string[]).includes(v);
}

/**
 * 진입 지점을 달아 둔 안내 페이지 주소.
 *
 * 왜 클릭 핸들러가 아니라 주소에 담는가
 *   그중 **두 곳(FAQ · FOR YOU 카드)은 어드민이 적는 문구 안의 링크**다.
 *   거기에는 자바스크립트를 끼울 자리가 없다. 주소에 담아 두면 도착한 페이지가
 *   한 번에 집계하므로 네 곳을 같은 방법으로 잴 수 있다.
 *
 * ⚠️ 주소의 값은 누구나 바꿀 수 있다. 받는 쪽(`/group`)에서 isGroupEntry 로 거른다.
 */
export function groupBookingHref(entry: GroupEntryKey): string {
  return `${GROUP_BOOKING_PATH}?from=${entry}`;
}
