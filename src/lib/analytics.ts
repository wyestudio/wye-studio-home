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
 * ⚠️ 매개변수는 기존 것(`sessionId`/`themeLabel`)만 쓴다 — GTM 에 데이터 영역
 *    변수를 새로 만들지 않아도 되도록. 트리거와 태그는 새로 만들어야 한다
 *    (ANALYTICS.md 의 체크리스트).
 * ⚠️ **신청 폼이 두 개다**(신규 `/themes/…`, 옛 `/sessions/…`). 이름을 여기 모아
 *    두는 이유다 — 한쪽만 고치면 집계가 반쪽이 된다.
 */
export const APPLY_STEP_EVENT: Record<number, string> = {
  1: "신청 약관동의",
  2: "신청 제출단계",
};
