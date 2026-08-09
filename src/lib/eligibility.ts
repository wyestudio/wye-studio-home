// 2026 베타 기준 스냅샷 — 로그인 없이 신청 시점에 직접 받는 출생년도 제한.
// 법적 나이 제한이 아니라 "비슷한 또래끼리 즐기기 위함"이라 매 시즌 조정될 수 있다.
export const ELIGIBLE_BIRTH_YEAR_MIN = 1990;
export const ELIGIBLE_BIRTH_YEAR_MAX = 1999;

export function isEligibleBirthYear(year: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= ELIGIBLE_BIRTH_YEAR_MIN &&
    year <= ELIGIBLE_BIRTH_YEAR_MAX
  );
}
