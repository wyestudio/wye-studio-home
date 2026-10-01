declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function pushDataLayerEvent(
  event: string,
  params?: Record<string, unknown>
) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push({ event, ...params });
}

/**
 * 신청 폼 2·3단계 진입 이벤트.
 *
 * 왜 필요한가
 *   1단계(`신청 시작`)와 `신청 완료` 사이가 통째로 비어 있어서, 신청을 하다 만
 *   사람이 **정보입력에서 막힌 건지 · 약관에서 튄 건지 · 입금정보에서 그만둔
 *   건지** 가를 수 없었다. 세 단계가 전부 같은 주소(`/themes/[slug]/apply`)라
 *   경로로도 못 가른다.
 *
 * ⚠️ 이름을 바꾸면 GTM 트리거(`CE - 신청 약관동의`·`CE - 신청 제출단계`)도 같이
 *    바꿔야 한다. 한 글자만 달라도 에러 없이 안 잡힌다 — ANALYTICS.md 참고.
 */
export const APPLY_STEP_EVENT: Record<number, string> = {
  1: "신청 약관동의",
  2: "신청 제출단계",
};

// ─────────────────────────────────────────────────────────────────
// 범용 GA4 이벤트 (2026-09-30)
//
// 위 신청 이벤트들은 하나마다 GTM 에 트리거 1개 + 태그 1개를 손으로 만들어야
// 했다. 그 수작업이 이 프로젝트에서 추적이 조용히 끊긴 사고의 원인이었다
// (ANALYTICS.md 맨 위 경고 — 두 번 겪었다).
//
// 그래서 아래부터는 **dataLayer 이벤트 이름을 `wye_ga4` 하나로 고정**하고,
// 실제 GA4 이벤트 이름은 `ga4Event` 값으로 넘긴다. GTM 에는 트리거 1개 + 태그
// 1개만 있으면 되고, **새 이벤트를 추가할 때 GTM 을 건드릴 필요가 없다.**
//
// 기존 신청 이벤트 4개는 `ga4Event` 를 안 보내므로 이 태그에 걸리지 않는다
// (중복 발사 없음). 그쪽은 Meta Pixel 도 같은 트리거를 쓰고 있어 건드리지 않는다.
// ─────────────────────────────────────────────────────────────────

/** GTM 트리거 `CE - WYE GA4` 가 잡는 dataLayer 이벤트 이름. */
export const GA4_DATALAYER_EVENT = "wye_ga4";

/**
 * GTM 태그에 미리 뚫어 둔 매개변수 슬롯.
 *
 * ⚠️ **매번 전부 채워 보낸다 — 안 쓰는 칸은 undefined 로.**
 *    dataLayer 는 push 한 값이 누적된다. 앞 이벤트가 넣은 `sectionLabel` 을
 *    지우지 않으면, 뒤 이벤트(예: 신청하기 클릭)에도 그 값이 그대로 따라붙어
 *    엉뚱한 섹션에서 눌린 것처럼 집계된다. GTM 의 고전적인 함정이다.
 *
 * 여기 없는 키를 새로 쓰려면 그때는 GTM 에 변수 1개 + 태그에 행 1개를 더해야
 * 한다. 슬롯 안에서 해결되면 GTM 은 그대로 둔다.
 */
const GA4_PARAM_SLOTS = [
  "themeLabel",
  "sectionKey",
  "sectionLabel",
  "sectionIndex",
  "appSessionId",
] as const;

type Ga4Params = Partial<Record<(typeof GA4_PARAM_SLOTS)[number], string | number | null>>;

/**
 * GA4 이벤트 하나를 보낸다.
 *
 * @param name GA4 에 찍힐 이벤트 이름. **영문 snake_case** (GA4 명명 규칙).
 */
export function pushGa4Event(name: string, params: Ga4Params = {}) {
  const slots: Record<string, unknown> = {};
  // 쓰지 않는 슬롯은 undefined 로 덮어 앞 이벤트의 값을 지운다.
  for (const key of GA4_PARAM_SLOTS) slots[key] = params[key] ?? undefined;
  pushDataLayerEvent(GA4_DATALAYER_EVENT, { ga4Event: name, ...slots });
}

/**
 * 테마 상세 페이지 안에서 재는 이벤트들.
 *
 * 왜 필요한가
 *   퍼널이 "테마 상세 조회 → 신청 폼 열람" 한 칸으로 뭉쳐 있어서, 그 사이에서
 *   빠진 사람이 **상세를 안 읽고 나간 건지 · 읽고도 회차 선택까지 안 내려간
 *   건지 · 내려갔는데 원하는 날짜가 마감이라 나간 건지** 가를 수 없었다.
 *   셋은 고칠 것이 서로 다르다(콘텐츠 / 동선 / 회차 편성).
 *
 * ⚠️ 이름을 바꾸면 어드민 분석 화면(`src/lib/ga4.ts` 의 `DETAIL_EVENT`)도 같이
 *    바꾼다. GTM 은 이름을 모르므로 건드릴 필요가 없다.
 */
export const DETAIL_EVENT = {
  /** 상세의 블록 하나가 화면에 들어왔다. 블록마다 페이지 방문당 한 번. */
  sectionView: "detail_section_view",
  /** 회차(시각) 를 골랐다. */
  sessionPick: "detail_session_pick",
  /** 마감된 회차를 눌러 봤다 — 원하는 날짜가 없다는 신호다. */
  soldOutClick: "detail_sold_out_click",
  /** 신청하기를 눌러 신청 폼으로 넘어갔다. */
  applyClick: "detail_apply_click",
  /** 회차를 안 고른 채 신청하기를 눌러 회차 선택으로 되돌아갔다. */
  bookingScroll: "detail_booking_scroll",
} as const;
