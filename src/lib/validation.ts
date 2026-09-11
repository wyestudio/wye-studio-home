// 신청 폼 필드 유효성 검사 — 한글/숫자/영문/기호 허용목록 기반
// 모든 함수는 클라이언트/서버 양쪽에서 import 가능 (순수 함수, 의존성 없음)

export const KOREAN_NAME_PATTERN = /^[가-힣]{2,10}$/;
export function isValidKoreanName(name: string): boolean {
  return KOREAN_NAME_PATTERN.test(name.trim());
}

// 닉네임: 한글(완성형+자모)/영문(소문자만)/숫자, 공백/특수문자/대문자 불허
export const NICKNAME_PATTERN = /^[가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]{1,12}$/;
export function isValidNickname(nickname: string): boolean {
  if (!nickname || nickname.trim() === "") return true; // 선택 필드
  return NICKNAME_PATTERN.test(nickname.trim());
}

// 방탈출 경험 횟수 범위
// ⚠️ application_attendees.experience_range CHECK 제약과 값이 맞아야 한다.
//    옛 값 '200+' 는 8/29 신청에 남아 있어 제약에서만 계속 허용한다(새로 고르진 않는다).
export const EXPERIENCE_RANGES = ["0", "1-50", "50-100", "100-200", "200-500", "500+"] as const;
export type ExperienceRange = (typeof EXPERIENCE_RANGES)[number];

/** 저장된 값을 화면에 쓸 때 쓴다. 옛 값('200+')도 들어올 수 있어 Record<string> 이다. */
export const EXPERIENCE_RANGE_LABELS: Record<string, string> = {
  // 방탈출에서는 "몇 방 했다" 로 센다.
  "0": "0방 (경험 없음)",
  "1-50": "1~50방",
  "50-100": "50~100방",
  "100-200": "100~200방",
  "200-500": "200~500방",
  "500+": "500방 이상",
  "200+": "200방 이상", // 8/29 신청에 남아 있는 옛 값
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

// 제출 단계의 '요청사항' — 비고(50자)보다 길게 받되 허용 문자는 같다.
export const REQUEST_NOTE_MAX_LENGTH = 200;
export const REQUEST_NOTE_PATTERN = /^[가-힣a-zA-Z0-9\s.,!?~()·:;\-]{0,200}$/;
export function isValidRequestNote(notes: string): boolean {
  if (!notes || notes.trim() === "") return true; // 선택 필드
  return REQUEST_NOTE_PATTERN.test(notes);
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
      invalid: "신청 가능한 출생년도를 선택해주세요.",
    },
    gender: {
      required: "성별을 선택해주세요.",
      invalid: "남성 또는 여성을 선택해주세요.",
    },
    experienceRange: {
      required: "방탈출 경험을 선택해주세요.",
      invalid: "유효한 경험 구간을 선택해주세요.",
    },
    nickname: {
      invalid: "닉네임은 한글/영문 소문자/숫자 1~12자만 가능합니다.",
    },
    notes: {
      invalid: "요청사항은 200자 이내이고, 한글/영문/숫자/기본 기호만 가능합니다.",
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
