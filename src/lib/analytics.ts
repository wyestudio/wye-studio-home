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
