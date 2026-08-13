// 신청 폼 필드 유효성 검사 — 한글/숫자/영문/기호 허용목록 기반
// 모든 함수는 클라이언트/서버 양쪽에서 import 가능 (순수 함수, 의존성 없음)

export const KOREAN_NAME_PATTERN = /^[가-힣]{2,10}$/;
export function isValidKoreanName(name: string): boolean {
  return KOREAN_NAME_PATTERN.test(name.trim());
}

// 닉네임: 한글/영문(소문자만)/숫자, 공백/특수문자/대문자 불허
export const NICKNAME_PATTERN = /^[가-힣a-z0-9]{1,12}$/;
export function isValidNickname(nickname: string): boolean {
  if (!nickname || nickname.trim() === "") return true; // 선택 필드
  return NICKNAME_PATTERN.test(nickname.trim());
}

// 방탈출 경험 횟수 범위
export const EXPERIENCE_RANGES = ["0", "1-50", "50-100", "100-200", "200+"] as const;
export type ExperienceRange = (typeof EXPERIENCE_RANGES)[number];

export const EXPERIENCE_RANGE_LABELS: Record<ExperienceRange, string> = {
  "0": "0회 (경험 없음)",
  "1-50": "1~50회",
  "50-100": "50~100회",
  "100-200": "100~200회",
  "200+": "200회 이상",
};

export function isValidExperienceRange(v: string): v is ExperienceRange {
  return EXPERIENCE_RANGES.includes(v as ExperienceRange);
}

// 그룹 비고(notes): 한글/영문/숫자/기본 기호만, <>&"'\ 등 HTML/스크립트 관련 문자 제외
export const NOTES_MAX_LENGTH = 50;
export const NOTES_PATTERN = /^[가-힣a-zA-Z0-9\s.,!?~()·:;\-]{0,50}$/;
export function isValidNotes(notes: string): boolean {
  if (!notes || notes.trim() === "") return true; // 선택 필드
  return NOTES_PATTERN.test(notes);
}

// 유효성 검사 오류 메시지 생성 헬퍼
export function getValidationErrorMessage(field: string, reason: string): string {
  const messages: Record<string, Record<string, string>> = {
    name: {
      required: "이름을 입력해주세요.",
      invalid: "이름은 한글 2~10자만 가능합니다.",
    },
    phone: {
      required: "전화번호를 입력해주세요.",
      invalid: "올바른 휴대폰 번호 형식이 아니에요.",
    },
    birthYear: {
      required: "출생년도를 선택해주세요.",
      invalid: "1990~1999년생만 선택 가능합니다.",
    },
    gender: {
      required: "성별을 선택해주세요.",
      invalid: "남성 또는 여성을 선택해주세요.",
    },
    experienceRange: {
      required: "방탈출 경험 횟수를 선택해주세요.",
      invalid: "유효한 경험 횟수를 선택해주세요.",
    },
    nickname: {
      invalid: "닉네임은 한글/영문 소문자/숫자 1~12자만 가능합니다.",
    },
    notes: {
      invalid: "비고는 50자 이내이고, 한글/영문/숫자/기본 기호만 가능합니다.",
    },
    depositorName: {
      required: "입금자명을 입력해주세요.",
      invalid: "입금자명은 한글 2~10자만 가능합니다.",
    },
    agreedTerms: {
      required: "약관에 동의해야 신청할 수 있습니다.",
    },
    confirmationCode: {
      required: "접수번호를 입력해주세요.",
      invalid: "접수번호는 6자리 숫자예요.",
    },
  };

  return messages[field]?.[reason] ?? `${field} 입력값이 올바르지 않습니다.`;
}
