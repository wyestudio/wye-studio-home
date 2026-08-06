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
  user_id: string;
  depositor_name: string;
  agreed_terms: boolean;
  confirmation_code: string;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  created_at: string;
};
