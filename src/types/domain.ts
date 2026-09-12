export type SessionSlot = "afternoon" | "evening";
export type SessionStatus = "open" | "closed" | "cancelled";
export type ApplicationStatus = "waiting" | "confirmed" | "cancelled";
export type PaymentStatus = "pending" | "confirmed" | "cancelled";
export type Gender = "M" | "F";
export type SessionType = "그룹" | "소개팅";

export type Session = {
  id: string;
  /** Phase 1 에서 신설. 신규(테마 기반) 회차만 값이 있고 과거 회차는 null */
  theme_id?: string | null;
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
  difficulty: number;
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
  // 신청 확정(status='confirmed')이면서 입금까지 확인된(payment_status='confirmed') 인원.
  // 마감/마감임박/잔여석 뱃지는 이 값을 기준으로 판정한다 — 확정만 되고 아직 입금 전인
  // 신청까지 자리를 차지한 것으로 세면 실제로는 비어있는 자리를 마감으로 표시하게 된다.
  paid_confirmed_count: number;
  male_paid_confirmed_count: number;
  female_paid_confirmed_count: number;
};

// 로그인 시스템(휴면 처리됨)이 쓰던 타입 — 더 이상 신청 플로우에서 쓰이지 않지만
// src/lib/profile.ts 등 휴면 코드가 계속 참조하므로 남겨둠.
/**
 * 회원 프로필.
 *
 * my_profile() RPC 가 돌려주는 모양이다. 전화번호는 암호화 저장이라
 * 복호화된 값이 phone 으로 온다.
 * birth_date·gender 는 회원제 시절 필수였으나 지금은 출생연도만 받고
 * 성별은 선택이다 (D-03·D-04).
 */
export type Profile = {
  id: string;
  name: string;
  phone: string;
  birth_year: number | null;
  gender: Gender | null;
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
  refund_completed_at?: string | null;
  promoted_from_waiting_at?: string | null;
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

// "200+" 는 8/29 신청에 남아 있는 옛 값. 새로 고를 수는 없지만 읽을 수는 있어야 한다.
export type ExperienceRange = "0" | "1-50" | "50-100" | "100-200" | "200-500" | "500+" | "200+";

/**
 * 참여내역 조회(lookup_application_v2 RPC) 결과.
 *
 * 이 한 타입이 신·구 신청을 모두 담는다. DB 함수가 coalesce 로 양쪽에서
 * 값을 끌어오므로, 기존 8/29 신청도 새 구조 신청도 같은 모양으로 온다.
 */
export type ApplicationLookupResult = {
  theme_name: string;
  /** 테마 페이지로 돌아가는 링크. 이관 전 옛 회차는 null */
  theme_slug: string | null;
  /** 테마 카테고리(파티형 방탈출 등). 없으면 배지를 안 그린다 */
  category_name: string | null;
  /** 테마 강조색. 없으면 기본 강조색 */
  accent_color: string | null;
  /** 과거 회차의 진행 형식(그룹/소개팅). 신규 회차는 null */
  format_label: string | null;
  venue_area: string;
  start_at: string;
  end_at: string | null;
  /** 회차별 최소 연령. 과거 회차는 null */
  min_age: number | null;
  headcount: number;
  unit_price_krw: number;
  /** 할인 전 금액. 쿠폰을 안 썼으면 amount_krw 와 같다 */
  base_amount_krw: number;
  /** 쿠폰 할인액. 없으면 0 */
  discount_krw: number;
  amount_krw: number;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  confirmation_code: string;
  created_at: string;
  payment_confirmed_sms_sent_at: string | null;
  notes: string | null;
  waiting_number: number | null;
  attendees: ApplicationAttendee[];
  /** 입금이 확인된 시각. 문자 발송과 무관하게 찍힌다(어드민 수동 등록 포함) */
  paid_at: string | null;
  /** 취소된 시각. 환불 금액을 계산하는 기준 시점이다. 2026-09-13 이전 취소는 null */
  cancelled_at: string | null;
  /** 환불이 실제로 끝난 시각. 아직이면 null */
  refund_completed_at: string | null;
};
