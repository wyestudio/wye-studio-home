import type { Session, SessionStats } from "@/types/domain";
import { isDatingTheme } from "@/lib/theme";

// 즉시확정 정원(capacity_confirm_line) 대비 남은 자리 비율이 이 값 이하로 떨어지면 "마감임박" 표시.
// 즉시확정 마감 이후엔 대기로 넘어가므로, 실제 정원(capacity_max) 소진이 아니라
// 이 즉시확정 라인 기준으로 임박 여부를 판단한다.
const CLOSING_SOON_RATIO = 0.25;

// 실제 정원/상태와 무관하게 "마감" 리본을 강제로 띄우고 싶은 회차의 slug.
const FORCE_CLOSED_DISPLAY_SLUGS: string[] = [];

export function isForceClosedForDisplay(session: Session): boolean {
  return FORCE_CLOSED_DISPLAY_SLUGS.includes(session.slug);
}

// 실제 잔여석과 무관하게 "마감임박" 리본 + 잔여석 뱃지에 표시할 숫자를 강제 지정하고 싶은
// 그룹 회차의 slug→잔여석.
const FORCE_CLOSING_SOON_SLUGS: Record<string, number> = {};

function getForcedClosingSoonSeats(session: Session): number | null {
  return session.slug in FORCE_CLOSING_SOON_SLUGS ? FORCE_CLOSING_SOON_SLUGS[session.slug] : null;
}

function isNearConfirmLine(confirmedCount: number, confirmLine: number): boolean {
  const remaining = confirmLine - confirmedCount;
  return remaining > 0 && remaining <= confirmLine * CLOSING_SOON_RATIO;
}

// 소개팅 성별별 "마감" 판정 — 실제 정원(male_closed/female_closed, capacity_max 도달)뿐
// 아니라 즉시확정 라인(capacity_confirm_line_male/female) 도달도 화면상으로는 같은
// "마감" 리본으로 취급한다(대기는 capacity_max까지 계속 받음, 즉시확정만 종료).
// 판정 기준은 입금 확인까지 완료된 인원(paid_confirmed_count) — 신청만 확정되고
// 아직 입금 전인 자리까지 채워진 것으로 세면 실제로는 비어있는 자리를 마감으로 표시하게 된다.
export function isGenderConfirmClosed(
  session: Session,
  stats: SessionStats | null | undefined,
  gender: "male" | "female"
): boolean {
  const hardClosed = gender === "male" ? session.male_closed : session.female_closed;
  if (hardClosed || !stats) return hardClosed;

  const line = (gender === "male" ? session.capacity_confirm_line_male : session.capacity_confirm_line_female) ?? 0;
  const paidConfirmedCount = gender === "male" ? stats.male_paid_confirmed_count : stats.female_paid_confirmed_count;
  return line - paidConfirmedCount <= 0;
}

// 회차 카드에 표시할 "마감임박" 리본 라벨(그룹 전용). 소개팅은 성별별로 갈리므로
// 리본 대신 closedLabel(성별 마감)과 getGenderSeatBadges(잔여석 뱃지)로 표시한다.
export function getClosingSoonLabel(session: Session, stats: SessionStats | null | undefined): string | null {
  if (session.status !== "open" || isDatingTheme(session.session_type)) return null;
  if (getForcedClosingSoonSeats(session) !== null) return "마감임박";

  if (!stats) return null;
  return isNearConfirmLine(stats.paid_confirmed_count, session.capacity_confirm_line) ? "마감임박" : null;
}

// 그룹 회차 카드에 표시할 잔여석 뱃지(예: "1석 남음"). 소개팅의 getGenderSeatBadges와 대응.
export function getGroupSeatBadge(session: Session, stats: SessionStats | null | undefined): string | null {
  if (session.status !== "open" || isDatingTheme(session.session_type)) return null;

  const forcedSeats = getForcedClosingSoonSeats(session);
  if (forcedSeats !== null) return `${forcedSeats}석 남음`;

  if (!stats) return null;
  const remaining = session.capacity_confirm_line - stats.paid_confirmed_count;
  return isNearConfirmLine(stats.paid_confirmed_count, session.capacity_confirm_line) ? `${remaining}석 남음` : null;
}

// 소개팅 카드에 별도 뱃지로 표시할 성별별 잔여석 문구(예: "여성 1석 남음").
// 이미 즉시확정이 마감된 성별(isGenderConfirmClosed)은 리본 쪽에서 "OO 마감"으로
// 표시하므로 여기서는 제외해 중복 표시하지 않는다.
export function getGenderSeatBadges(session: Session, stats: SessionStats | null | undefined): string[] {
  if (!stats || session.status !== "open" || !isDatingTheme(session.session_type)) return [];

  const badges: string[] = [];

  if (!isGenderConfirmClosed(session, stats, "male")) {
    const maleLine = session.capacity_confirm_line_male ?? 0;
    const maleRemaining = maleLine - stats.male_paid_confirmed_count;
    if (isNearConfirmLine(stats.male_paid_confirmed_count, maleLine)) badges.push(`남성 ${maleRemaining}석 남음`);
  }

  if (!isGenderConfirmClosed(session, stats, "female")) {
    const femaleLine = session.capacity_confirm_line_female ?? 0;
    const femaleRemaining = femaleLine - stats.female_paid_confirmed_count;
    if (isNearConfirmLine(stats.female_paid_confirmed_count, femaleLine)) badges.push(`여성 ${femaleRemaining}석 남음`);
  }

  return badges;
}
