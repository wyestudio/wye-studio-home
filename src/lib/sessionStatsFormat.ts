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

/**
 * 회차별 확정·대기 인원을 이미 읽어둔 신청·참여자 목록에서 계산한다.
 *
 * ⚠️ 예전에는 회차마다 get_session_stats() RPC 를 한 번씩 불렀다. 롤링 오픈으로
 *    회차가 수백 개가 되면서 대시보드 한 번 여는 데 RPC 가 수백 번 나가게 됐다.
 *    같은 값을 이미 가진 데이터로 계산할 수 있으므로 여기서 한 번에 만든다.
 *    판정 기준은 DB 의 get_session_stats() 와 같아야 한다.
 */
export function computeSessionStats(
  applications: { id: string; session_id: string; status: string; payment_status: string }[],
  attendees: { application_id: string; gender: string | null }[]
): Map<string, SessionStats> {
  const appById = new Map(applications.map((a) => [a.id, a]));
  const out = new Map<string, SessionStats>();

  const blank = (): SessionStats => ({
    confirmed_count: 0,
    waiting_count: 0,
    male_confirmed_count: 0,
    male_waiting_count: 0,
    female_confirmed_count: 0,
    female_waiting_count: 0,
    paid_confirmed_count: 0,
    male_paid_confirmed_count: 0,
    female_paid_confirmed_count: 0,
  });

  for (const at of attendees) {
    const app = appById.get(at.application_id);
    if (!app) continue;
    if (app.status !== "confirmed" && app.status !== "waiting") continue;

    const s = out.get(app.session_id) ?? blank();
    const male = at.gender === "M";
    const female = at.gender === "F";

    if (app.status === "confirmed") {
      s.confirmed_count += 1;
      if (male) s.male_confirmed_count += 1;
      if (female) s.female_confirmed_count += 1;
      if (app.payment_status === "confirmed") {
        s.paid_confirmed_count += 1;
        if (male) s.male_paid_confirmed_count += 1;
        if (female) s.female_paid_confirmed_count += 1;
      }
    } else {
      s.waiting_count += 1;
      if (male) s.male_waiting_count += 1;
      if (female) s.female_waiting_count += 1;
    }
    out.set(app.session_id, s);
  }
  return out;
}
