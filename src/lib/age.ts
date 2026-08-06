export function calculateKoreanInternationalAge(birthDateStr: string, on = new Date()): number {
  const birth = new Date(birthDateStr);
  let age = on.getFullYear() - birth.getFullYear();
  const monthDiff = on.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export const MIN_SIGNUP_AGE = 19;

export function isAdult(birthDateStr: string, on = new Date()): boolean {
  return calculateKoreanInternationalAge(birthDateStr, on) >= MIN_SIGNUP_AGE;
}
