// 2026 베타 기준 스냅샷 — 로그인 없이 신청 시점에 직접 받는 출생년도 제한.
// 법적 나이 제한이 아니라 "비슷한 또래끼리 즐기기 위함"이라 매 시즌 조정될 수 있다.
// 소개팅은 또래감을 위해 좁은 범위, 모임은 20대·30대까지 넓은 범위를 받는다.
export const DATING_BIRTH_YEAR_MIN = 1990;
export const DATING_BIRTH_YEAR_MAX = 1999;
export const MEETING_BIRTH_YEAR_MIN = 1987;
export const MEETING_BIRTH_YEAR_MAX = 2006;

export function getEligibleBirthYearRange(isDatingSession: boolean) {
  return isDatingSession
    ? { min: DATING_BIRTH_YEAR_MIN, max: DATING_BIRTH_YEAR_MAX }
    : { min: MEETING_BIRTH_YEAR_MIN, max: MEETING_BIRTH_YEAR_MAX };
}

export function isEligibleBirthYear(year: number, isDatingSession: boolean): boolean {
  const { min, max } = getEligibleBirthYearRange(isDatingSession);
  return Number.isInteger(year) && year >= min && year <= max;
}

export function eligibleBirthYearRangeLabel(isDatingSession: boolean): string {
  const { min, max } = getEligibleBirthYearRange(isDatingSession);
  return `${min}~${max}년생`;
}
