import { isPartyGo } from "@/lib/adminTodos";
import { CLOSURE_BUFFER_MINUTES } from "@/lib/groupPricing";

/**
 * 홈 달력 — 하루 일정의 순서(2026-11-27 대표님).
 *
 *   0 단체 확정            맨 위. 여러 건이면 시간순
 *   1 진행이 확정된 회차    파티 · 노말을 섞어 시간순
 *   2 신청은 있지만 미확정  파티 「인원 모으는 중」 · 노말 「입금 확인 전」
 *   4 직접 막은 일정(마감)
 *   5 단체 문의(희망)
 *   6 빈 회차
 *   7 닫힌 회차            단체 시간과 겹쳐 닫혔거나 비활성화한 회차 — 흐리게, 맨 아래
 *
 * 달력 칸과 그날 목록이 같은 순서를 쓴다. 순수 함수만 둔다(화면 · DB 를 모른다).
 */
export const DAY_RANK = { group: 0, go: 1, gathering: 2, closure: 4, inquiry: 5, empty: 6, off: 7 } as const;

export type DaySessionKind = "party" | "normal" | "other";

export type DaySession = {
  status: string;
  /** 취소를 뺀 신청 · 예약 인원 */
  booked_people: number;
  confirmed: number;
  /** 입금까지 확인된 확정 인원 */
  paid_confirmed: number;
  start_at: string;
  /** 끝나는 시각. 모르면 null — 시작 시각 한 점으로 본다. */
  end_at: string | null;
};

/** 확정된 단체 일정 한 건(한국 시간). */
export type GroupSlot = { date: string; time: string; minutes: number };

/**
 * 회차 진행이 확정됐는가.
 *   파티모드 — 입금 확인된 사람이 1명이라도 있거나 확정 6명 이상(isPartyGo)
 *   노말모드 — 입금이 확인된 예약이 있으면 확정(2026-11-27 대표님)
 * 신청이 없거나 비활성화한 회차, 모드가 없는 옛 테마는 판정하지 않는다(null).
 */
export function sessionGo(kind: DaySessionKind, s: DaySession): boolean | null {
  if (s.status === "cancelled" || s.booked_people <= 0) return null;
  if (kind === "party") return isPartyGo(s);
  if (kind === "normal") return s.paid_confirmed >= 1;
  return null;
}

/**
 * 단체 시간 때문에 닫힌 회차인가 — 열려 있지 않고, 신청이 없고, 확정된 단체 일정과 시간이 겹친다.
 * 겹침은 단체 앞뒤 세팅 · 정리 시간(CLOSURE_BUFFER_MINUTES)까지 본다 — 단체를 확정할 때 회차를 닫는 범위와 같다.
 * ⚠️ 신청자가 있어 닫히지 않고 남은 회차는 해당하지 않는다(그 회차는 그대로 진행한다).
 */
export function blockedByGroup(s: DaySession, slots: readonly GroupSlot[]): boolean {
  if (s.status === "open" || s.booked_people > 0) return false;
  const start = Date.parse(s.start_at);
  const end = s.end_at ? Date.parse(s.end_at) : start + 60_000;
  const buffer = CLOSURE_BUFFER_MINUTES * 60_000;
  return slots.some((g) => {
    const groupStart = Date.parse(`${g.date}T${g.time}:00+09:00`);
    if (Number.isNaN(groupStart)) return false;
    return start < groupStart + g.minutes * 60_000 + buffer && end > groupStart - buffer;
  });
}

/** 회차의 순서 — 작을수록 위. */
export function sessionRank(kind: DaySessionKind, s: DaySession, slots: readonly GroupSlot[]): number {
  if (s.status === "cancelled" || blockedByGroup(s, slots)) return DAY_RANK.off;
  if (sessionGo(kind, s)) return DAY_RANK.go;
  return s.booked_people > 0 ? DAY_RANK.gathering : DAY_RANK.empty;
}

/** 순서 → 시간순으로 줄 세운다(시각은 'HH:MM'). */
export function sortDay<T extends { rank: number; time: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.rank - b.rank || a.time.localeCompare(b.time));
}
