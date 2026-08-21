import type { Session, SessionStats } from "@/types/domain";
import { isDatingTheme } from "@/lib/theme";

// 관리자 목록/상세 페이지에서 공통으로 쓰는 정원·인원 표시 포맷.
export function formatCapacityLine(session: Session): string {
  if (isDatingTheme(session.session_type)) {
    return `정원: 남 ${session.capacity_max_male} · 여 ${session.capacity_max_female}`;
  }
  return `정원: ${session.capacity_max}명`;
}

export function formatHeadcountLine(stats: SessionStats): string {
  return `확정: 남 ${stats.male_confirmed_count} · 여 ${stats.female_confirmed_count}  ·  대기: 남 ${stats.male_waiting_count} · 여 ${stats.female_waiting_count}`;
}

// 신청 상태는 확정(status='confirmed')인데 아직 입금은 확인 안 된(payment_status
// !== 'confirmed') 인원 수를 세션별로 센다. 관리자 목록/상세 페이지에서 공통으로 씀.
export function countUnpaidConfirmed(
  applications: { id: string; session_id: string; status: string; payment_status: string }[],
  attendees: { application_id: string }[]
): Map<string, number> {
  const appById = new Map(applications.map((a) => [a.id, a]));
  const counts = new Map<string, number>();
  for (const attendee of attendees) {
    const app = appById.get(attendee.application_id);
    if (!app || app.status !== "confirmed" || app.payment_status === "confirmed") continue;
    counts.set(app.session_id, (counts.get(app.session_id) ?? 0) + 1);
  }
  return counts;
}
