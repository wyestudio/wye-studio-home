// 2026 베타 기준 스냅샷 — 로그인 없이 신청 시점에 직접 받는 출생년도 제한.
// 법적 나이 제한이 아니라 "비슷한 또래끼리 즐기기 위함"이라 매 시즌 조정될 수 있다.
// 소개팅은 또래감을 위해 좁은 범위, 모임은 20대·30대까지 넓은 범위를 받는다.
export const DATING_BIRTH_YEAR_MIN = 1990;
export const DATING_BIRTH_YEAR_MAX = 2001;
export const MEETING_BIRTH_YEAR_MIN = 1987;
export const MEETING_BIRTH_YEAR_MAX = 2007;

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

// ── 회차 min_age 기준 (2026-09-28) ──────────────────────────────
//
// 위의 출생년도 범위는 2026 베타 때의 스냅샷이고, 지금 고객 신청 경로는
// 회차의 `min_age` 로 판정한다. 어드민 수동 등록도 같은 기준을 쓴다.
//
// ⚠️ 최종 판정은 DB 의 is_eligible_birth_year(p_year, p_min_age) 가 한다.
//    여기 있는 건 화면에서 일찍 걸러주기 위한 같은 식의 복사다 —
//    식을 바꾸려면 DB 쪽을 먼저 바꾼다.
//    DB: select p_year <= extract(year from now() at 'Asia/Seoul') - (p_min_age + 1)

/** 그 회차에 참여 가능한 가장 늦은 출생연도 */
export function maxBirthYearForMinAge(minAge: number): number {
  const seoulYear = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date())
  );
  return seoulYear - (minAge + 1);
}

export function isEligibleBirthYearForMinAge(year: number, minAge: number): boolean {
  return Number.isInteger(year) && year <= maxBirthYearForMinAge(minAge);
}
