export type SessionSlot = "afternoon" | "evening";
export type SessionStatus = "open" | "closed";
export type ApplicationStatus = "waiting" | "confirmed" | "cancelled";
export type PaymentStatus = "pending" | "confirmed" | "cancelled";
export type Gender = "M" | "F";

export type Session = {
  id: string;
  event_date: string;
  slot: SessionSlot;
  title: string;
  theme_label: string;
  start_at: string;
  end_at: string | null;
  venue_area: string;
  price_krw: number;
  capacity_min: number;
  capacity_confirm_line: number;
  capacity_max: number;
  status: SessionStatus;
  description: string | null;
  created_at: string;
};

export type SessionStats = {
  confirmed_count: number;
  waiting_count: number;
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
  created_at: string;
};

// 그룹 신청의 참여자 한 명(대표 신청자 포함). DB의 application_attendees와 대응.
export type ApplicationAttendee = {
  name: string;
  phone: string;
  birth_year: number;
  nickname: string | null;
  is_representative: boolean;
};

// 참여내역 조회(lookup_application RPC) 결과.
export type ApplicationLookupResult = {
  session_title: string;
  event_date: string;
  slot: SessionSlot;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  confirmation_code: string;
  depositor_name: string;
  created_at: string;
  attendees: ApplicationAttendee[];
};
