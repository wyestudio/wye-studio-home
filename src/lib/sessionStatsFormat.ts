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
