import { MASCOTS, type MascotId } from "@/lib/mascots";

/** 마스코트 id → 이름("우쥬") */
export const mascotName = (id: string) => MASCOTS[id as MascotId]?.name ?? id;

/**
 * 방문 발자취 기록(visit_events)을 사람이 읽는 말로 — 어드민 「방문 발자취」 · 「고객」 이 같이 쓴다.
 * 이벤트 이름은 src/lib/analytics.ts 가 보내는 것 그대로다. 이름이 바뀌면 여기도 바꾼다.
 */

/** admin_visitor_list 의 stage 숫자 → 이름 */
export const STAGE_LABEL: Record<number, string> = {
  0: "둘러봄",
  1: "회차 고름",
  2: "신청하기 누름",
  3: "신청 시작",
  4: "약관 동의",
  5: "제출 단계",
  6: "신청 완료",
};

export const STAGE_TAG: Record<number, string> = {
  0: "bg-fill-strong text-muted",
  1: "bg-brand text-brand-foreground",
  2: "bg-brand text-brand-foreground",
  3: "bg-amber-400 text-black",
  4: "bg-amber-400 text-black",
  5: "bg-amber-400 text-black",
  6: "bg-green-500 text-black",
};

/** 경로 → 화면 이름. 모르는 경로는 그대로. */
export function pageLabel(path: string, themeNames: Map<string, string>): string {
  if (path === "/") return "홈";
  const apply = path.match(/^\/themes\/([^/]+)\/apply$/);
  if (apply) return `신청서 · ${themeNames.get(apply[1]) ?? apply[1]}`;
  const theme = path.match(/^\/themes\/([^/]+)$/);
  if (theme) return `테마 상세 · ${themeNames.get(theme[1]) ?? theme[1]}`;
  const fixed: Record<string, string> = {
    "/group": "단체 예약",
    "/lookup": "참여내역 조회",
    "/lookup/result": "조회 결과",
    "/contents": "콘텐츠 목록",
    "/notice": "공지",
    "/faq": "자주 묻는 질문",
    "/about": "소개",
    "/reviews": "후기",
    "/privacy": "개인정보처리방침",
    "/terms": "이용약관",
  };
  return fixed[path] ?? path;
}

type Meta = Record<string, unknown> | null;
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** 분석 이벤트 한 줄. sessionLabels: 회차 id → "11/7(토) 13:30" */
export function eventLabel(name: string, meta: Meta, sessionLabels: Map<string, string>): string {
  const session = sessionLabels.get(str(meta?.appSessionId)) ?? sessionLabels.get(str(meta?.sessionId)) ?? "";
  switch (name) {
    case "detail_section_view":
      return `상세에서 「${str(meta?.sectionLabel) || str(meta?.sectionKey)}」 봄`;
    case "detail_session_pick":
      return `회차 고름 ${session}`.trim();
    case "detail_sold_out_click":
      return `마감 회차 눌러 봄 ${session}`.trim();
    case "detail_apply_click":
      return session ? `신청하기 누름 (${session})` : "신청하기 누름";
    case "detail_booking_scroll":
      return "회차 안 고르고 신청하기 → 회차 선택으로";
    case "신청 시작":
    case "신청 약관동의":
    case "신청 제출단계":
      return `${name}${session ? ` (${session})` : ""}`;
    case "신청 완료":
      return `신청 완료${meta?.confirmationCode ? ` · 접수 ${str(meta.confirmationCode)}` : ""}`;
    case "group_entry_click":
      return `단체 예약으로 들어옴 (${str(meta?.sectionKey)})`;
    case "group_section_view":
      return `단체 페이지 「${str(meta?.sectionLabel) || str(meta?.sectionKey)}」 봄`;
    case "group_cta_click":
      return "단체 견적 신청하기 누름";
    case "group_quote_start":
      return "단체 견적서 쓰기 시작";
    case "group_quote_error":
      return `단체 견적 제출 막힘 (${str(meta?.sectionLabel)})`;
    case "group_quote_submit":
      return "단체 견적 접수";
    case "page_leave":
      return `화면을 떠남 · ${str(meta?.secs)}초 머묾 · ${str(meta?.scroll)}%까지 내려봄`;
    case "field_filled":
      return `「${str(meta?.sectionLabel)}」 입력함`;
    case "mascot_select":
      return `마스코트 ${mascotName(str(meta?.sectionLabel))}(으)로 커서 바꿈`;
    case "mascot_throw":
      return `마스코트 ${mascotName(str(meta?.sectionLabel))} 끌어서 던짐`;
    default:
      return name;
  }
}

/** 마지막으로 본 지 얼마나 됐나 */
export function ago(iso: string, nowMs: number): string {
  const m = Math.round((nowMs - Date.parse(iso)) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

/** 방문자 짧은 이름 — 번호 앞 4자리 */
export const visitorTag = (id: string) => `방문자 #${id.slice(0, 4)}`;

/**
 * Clarity 관리 화면 주소. 녹화 영상은 Clarity 밖으로 가져올 수 없어(공개 API 가 요약 숫자뿐) 링크로 넘긴다.
 * 운영에만 번호가 있다 — 없으면 null(테스트 사이트).
 */
export const CLARITY_URL = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
  ? `https://clarity.microsoft.com/projects/view/${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}/dashboard`
  : null;
