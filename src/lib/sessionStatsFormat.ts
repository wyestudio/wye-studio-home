import type { SessionStats } from "@/types/domain";

/**
 * 어드민 목록·상세에서 공통으로 쓰는 정원·인원 표시 포맷.
 *
 * 표시값은 session_display 뷰가 정한다. 화면이 sessions 테이블을 직접 읽으면
 * 신규 회차인데 옛 회차 컬럼(정원 50명, 성별 정원)이 나온다 — 실제로 그랬다.
 *
 * is_legacy 는 theme_id 유무가 아니라 format_label(소개팅/그룹) 유무로 판정된다.
 * Phase 2 이관으로 옛 회차에도 theme_id 가 생겼기 때문이다.
 */
export type SessionDisplayRow = {
  id: string;
  theme_name: string | null;
  format_label: string | null;
  is_legacy: boolean;
  capacity_confirm_line: number | null;
  capacity_max: number | null;
  capacity_max_male: number | null;
  capacity_max_female: number | null;
  link_slug: string | null;
  public_path: string | null;
  min_age: number | null;
  venue_area: string | null;
};

/** 성별 분리 정원은 옛 소개팅 회차에만 의미가 있다. */
function hasGenderSplit(sd: SessionDisplayRow): boolean {
  return sd.capacity_max_male != null && sd.capacity_max_female != null;
}

export function formatCapacityLine(sd: SessionDisplayRow): string {
  if (hasGenderSplit(sd)) {
    return `정원: 남 ${sd.capacity_max_male} · 여 ${sd.capacity_max_female} (총 ${sd.capacity_max}명)`;
  }
  if (sd.capacity_max == null) return "정원: -";
  // 신규 회차는 즉시확정 라인을 넘으면 대기로 받는다. 둘 다 보여야 운영 판단이 된다.
  return sd.capacity_confirm_line != null && sd.capacity_confirm_line !== sd.capacity_max
    ? `즉시확정 ${sd.capacity_confirm_line}명 · 정원 ${sd.capacity_max}명`
    : `정원: ${sd.capacity_max}명`;
}

export function formatHeadcountLine(sd: SessionDisplayRow, stats: SessionStats): string {
  if (hasGenderSplit(sd)) {
    return `확정: 남 ${stats.male_confirmed_count} · 여 ${stats.female_confirmed_count}  ·  대기: 남 ${stats.male_waiting_count} · 여 ${stats.female_waiting_count}`;
  }
  return `확정 ${stats.confirmed_count}명 · 대기 ${stats.waiting_count}명`;
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
