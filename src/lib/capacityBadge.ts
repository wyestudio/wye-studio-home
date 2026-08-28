import type { Session, SessionStats } from "@/types/domain";
import { isDatingTheme } from "@/lib/theme";

// 즉시확정 정원(capacity_confirm_line) 대비 남은 자리 비율이 이 값 이하로 떨어지면 "마감임박" 표시.
// 즉시확정 마감 이후엔 대기로 넘어가므로, 실제 정원(capacity_max) 소진이 아니라
// 이 즉시확정 라인 기준으로 임박 여부를 판단한다.
const CLOSING_SOON_RATIO = 0.25;

// 실제 정원/상태와 무관하게 "마감" 리본을 강제로 띄우고 싶은 회차의 slug.
// 2026-08-28: 그룹(0829-meeting) 회차는 20/24명으로 아직 자리가 있지만(신청은 계속 받음),
// 행사 하루 전 마감 임박감을 강조하려는 마케팅 판단으로 "마감" 표시만 강제함.
const FORCE_CLOSED_DISPLAY_SLUGS = ["0829-meeting"];

export function isForceClosedForDisplay(session: Session): boolean {
  return FORCE_CLOSED_DISPLAY_SLUGS.includes(session.slug);
}

function isNearConfirmLine(confirmedCount: number, confirmLine: number): boolean {
  const remaining = confirmLine - confirmedCount;
  return remaining > 0 && remaining <= confirmLine * CLOSING_SOON_RATIO;
}

// 소개팅 성별별 "마감" 판정 — 실제 정원(male_closed/female_closed, capacity_max 도달)뿐
// 아니라 즉시확정 라인(capacity_confirm_line_male/female) 도달도 화면상으로는 같은
// "마감" 리본으로 취급한다(대기는 capacity_max까지 계속 받음, 즉시확정만 종료).
export function isGenderConfirmClosed(
  session: Session,
  stats: SessionStats | null | undefined,
  gender: "male" | "female"
): boolean {
  const hardClosed = gender === "male" ? session.male_closed : session.female_closed;
  if (hardClosed || !stats) return hardClosed;

  const line = (gender === "male" ? session.capacity_confirm_line_male : session.capacity_confirm_line_female) ?? 0;
  const confirmedCount = gender === "male" ? stats.male_confirmed_count : stats.female_confirmed_count;
  return line - confirmedCount <= 0;
}

// 회차 카드에 표시할 "마감임박" 리본 라벨(그룹 전용). 소개팅은 성별별로 갈리므로
// 리본 대신 closedLabel(성별 마감)과 getGenderSeatBadges(잔여석 뱃지)로 표시한다.
export function getClosingSoonLabel(session: Session, stats: SessionStats | null | undefined): string | null {
  if (!stats || session.status !== "open" || isDatingTheme(session.session_type)) return null;

  return isNearConfirmLine(stats.confirmed_count, session.capacity_confirm_line) ? "마감임박" : null;
}

// 소개팅 카드에 별도 뱃지로 표시할 성별별 잔여석 문구(예: "여성 1석 남음").
// 이미 즉시확정이 마감된 성별(isGenderConfirmClosed)은 리본 쪽에서 "OO 마감"으로
// 표시하므로 여기서는 제외해 중복 표시하지 않는다.
export function getGenderSeatBadges(session: Session, stats: SessionStats | null | undefined): string[] {
  if (!stats || session.status !== "open" || !isDatingTheme(session.session_type)) return [];

  const badges: string[] = [];

  if (!isGenderConfirmClosed(session, stats, "male")) {
    const maleLine = session.capacity_confirm_line_male ?? 0;
    const maleRemaining = maleLine - stats.male_confirmed_count;
    if (isNearConfirmLine(stats.male_confirmed_count, maleLine)) badges.push(`남성 ${maleRemaining}석 남음`);
  }

  if (!isGenderConfirmClosed(session, stats, "female")) {
    const femaleLine = session.capacity_confirm_line_female ?? 0;
    const femaleRemaining = femaleLine - stats.female_confirmed_count;
    if (isNearConfirmLine(stats.female_confirmed_count, femaleLine)) badges.push(`여성 ${femaleRemaining}석 남음`);
  }

  return badges;
}
