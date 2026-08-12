// theme_label 비교를 한 곳에서 관리한다 — 이 문자열이 여러 파일에 흩어져
// 있으면 리브랜딩 등으로 값이 바뀔 때 한 곳이라도 놓쳐 성별 필수/그룹신청
// 제한 같은 로직이 조용히 깨질 수 있다. supabase-schema.sql의
// submit_application()에도 동일한 문자열이 하드코딩되어 있으니 값을 바꿀
// 땐 그쪽도 함께 갱신해야 한다.
export const DATING_THEME_LABEL = "바-ㅇ탈출(ver.소개팅)";

export function isDatingTheme(themeLabel: string): boolean {
  return themeLabel === DATING_THEME_LABEL;
}

export function getThemeTag(themeLabel: string): string {
  return isDatingTheme(themeLabel) ? "소개팅" : "모임";
}

export function getThemeBaseName(themeLabel: string): string {
  return themeLabel.replace(/\s*\(ver\.[^)]*\)\s*/, "").trim();
}

export function getThemeShortLabel(themeLabel: string): string {
  return isDatingTheme(themeLabel) ? "소개팅" : "모임";
}
