// 검색엔진에 색인되어야 하는 유일한 호스트. admin/test 서브도메인, Vercel 프리뷰
// 도메인, localhost 등은 전부 이 목록에 없으므로 기본값으로 노출 차단 대상이 된다
// (화이트리스트 방식 — 새 서브도메인이 생겨도 추가하지 않는 한 자동으로 안전하게 막힘).
export const PRODUCTION_HOSTS = new Set(["wouldyouescape.com", "www.wouldyouescape.com"]);

export function isProductionHost(host: string): boolean {
  return PRODUCTION_HOSTS.has(host);
}
