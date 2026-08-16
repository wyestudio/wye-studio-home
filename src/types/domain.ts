export type SessionSlot = "afternoon" | "evening";
export type SessionStatus = "open" | "closed" | "cancelled";
export type ApplicationStatus = "waiting" | "confirmed" | "cancelled";
export type PaymentStatus = "pending" | "confirmed" | "cancelled";
export type Gender = "M" | "F";
export type SessionType = "그룹" | "소개팅";

export type Session = {
  id: string;
  slug: string;
  event_date: string;
  slot: SessionSlot;
  title: string;
  theme_label: string;
  // v24부터 theme_label을 대체 — 테마명("바-ㅇ탈출")과 타입을 별도 컬럼으로 분리
  theme_name: string;
  session_type: SessionType;
  // 크로스테마 배타 판정 단위 — 같은 컨텐츠(예: "바-ㅇ탈출")를 공유하는
  // 소개팅/그룹 세션은 같은 값을 가지며, 이 값이 같은 사람은 1건만 신청 가능
  content_group: string;
  start_at: string;
  end_at: string | null;
  venue_area: string;
  price_krw: number;
  original_price_krw: number;
  capacity_min: number;
  capacity_confirm_line: number;
  capacity_max: number;
  // 소개팅(session_type='소개팅') 회차만 값이 있음 — 성비 분리 정원, 그룹은 null
  capacity_confirm_line_male: number | null;
  capacity_confirm_line_female: number | null;
  capacity_max_male: number | null;
  capacity_max_female: number | null;
  male_closed: boolean;
  female_closed: boolean;
  status: SessionStatus;
  description: string | null;
  created_at: string;
};

export type SessionStats = {
  confirmed_count: number;
  waiting_count: number;
  male_confirmed_count: number;
  male_waiting_count: number;
  female_confirmed_count: number;
  female_waiting_count: number;
};

// 로그인 시스템(휴면 처리됨)이 쓰던 타입 — 더 이상 신청 플로우에서 쓰이지 않지만
// src/lib/profile.ts 등 휴면 코드가 계속 참조하므로 남겨둠.
export type Profile = {
  id: string;
  name: string;
  phone: string;
  birth_date: string;
  gender: Gender;
  created_at: string;
};

export type Application = {
  id: string;
  session_id: string;
  depositor_name: string;
  agreed_terms: boolean;
  confirmation_code: string;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  waiting_number: number | null;
  created_at: string;
  refund_bank_name?: string | null;
  refund_account_number?: string | null;
  refund_account_holder?: string | null;
};

// 그룹 신청의 참여자 한 명(대표 신청자 포함). DB의 application_attendees와 대응.
export type ApplicationAttendee = {
  name: string;
  phone: string;
  birth_year: number;
  nickname: string | null;
  is_representative: boolean;
  gender: Gender | null;
  // 모든 테마에서 값이 채워짐
  experience_range: ExperienceRange | null;
};

export type ExperienceRange = "0" | "1-50" | "50-100" | "100-200" | "200+";

// 참여내역 조회(lookup_application RPC) 결과.
export type ApplicationLookupResult = {
  session_title: string;
  theme_label: string;
  theme_name: string;
  session_type: SessionType;
  venue_area: string;
  start_at: string;
  end_at: string | null;
  event_date: string;
  slot: SessionSlot;
  price_krw: number;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  confirmation_code: string;
  created_at: string;
  payment_confirmed_sms_sent_at: string | null;
  notes: string | null;
  waiting_number: number | null;
  attendees: ApplicationAttendee[];
};
