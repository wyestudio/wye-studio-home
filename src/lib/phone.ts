export function phoneDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

// 010/011/016/017/018/019로 시작하는 국내 휴대폰 번호, 총 10~11자리(하이픈 제외).
export function isValidPhoneDigits(digits: string) {
  return /^01[016789]\d{7,8}$/.test(digits);
}

// 화면에 보여줄 때만 하이픈을 붙인다. 저장/매칭에는 항상 순수 숫자만 쓴다.
// 이 검증을 도입하기 전에 하이픈이 섞인 채로 저장된 예전 데이터가 있을 수
// 있어, 우선 숫자만 남긴 뒤 포맷한다.
export function formatPhoneDigits(phone: string) {
  const digits = phoneDigits(phone);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

// 사용자가 타이핑 중인 입력값에 하이픈을 자동으로 삽입
// AttendeeCard의 3분할 방식과 다르게, 단일 input에서 타이핑하면서 실시간으로 포맷
export function formatPhoneInput(value: string) {
  const digits = phoneDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
