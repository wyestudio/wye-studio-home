import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY_RANK, blockedByGroup, sessionGo, sessionRank, sortDay, type DaySession, type GroupSlot } from "@/lib/adminDayOrder";

// 2026-11-28(토) 한국 시간 HH:MM 에 시작해 3시간 하는 회차
const session = (hhmm: string, over: Partial<DaySession> = {}): DaySession => {
  const start = Date.parse(`2026-11-28T${hhmm}:00+09:00`);
  return { status: "open", booked_people: 0, confirmed: 0, paid_confirmed: 0, start_at: new Date(start).toISOString(), end_at: new Date(start + 180 * 60_000).toISOString(), ...over };
};
const group: GroupSlot = { date: "2026-11-28", time: "13:30", minutes: 180 }; // 13:30 ~ 16:30

test("진행 확정 — 파티는 입금 1명 또는 확정 6명, 노말은 입금 확인된 예약", () => {
  assert.equal(sessionGo("party", session("19:30", { booked_people: 2, confirmed: 2, paid_confirmed: 1 })), true);
  assert.equal(sessionGo("party", session("19:30", { booked_people: 6, confirmed: 6 })), true);
  assert.equal(sessionGo("party", session("19:30", { booked_people: 3, confirmed: 3 })), false);
  assert.equal(sessionGo("normal", session("10:00", { booked_people: 4, confirmed: 4, paid_confirmed: 4 })), true);
  // 노말은 인원이 많아도 입금 확인 전이면 확정이 아니다.
  assert.equal(sessionGo("normal", session("10:00", { booked_people: 8, confirmed: 8 })), false);
  // 신청이 없거나 비활성화한 회차는 판정하지 않는다.
  assert.equal(sessionGo("party", session("19:30")), null);
  assert.equal(sessionGo("normal", session("10:00", { status: "cancelled", booked_people: 4, paid_confirmed: 4 })), null);
  assert.equal(sessionGo("other", session("10:00", { booked_people: 4, paid_confirmed: 4 })), null);
});

test("단체 시간과 겹쳐 닫힌 회차 — 닫혀 있고 신청이 없고, 앞뒤 1시간까지 겹칠 때만", () => {
  assert.equal(blockedByGroup(session("14:00", { status: "closed" }), [group]), true);
  // 단체 끝(16:30) + 정리 1시간 = 17:30 전에 시작하면 겹친다.
  assert.equal(blockedByGroup(session("17:00", { status: "closed" }), [group]), true);
  assert.equal(blockedByGroup(session("17:30", { status: "closed" }), [group]), false);
  // 단체 시작(13:30) − 세팅 1시간 = 12:30 뒤에 끝나면 겹친다. 09:00 회차는 12:00 에 끝난다.
  assert.equal(blockedByGroup(session("09:00", { status: "closed" }), [group]), false);
  assert.equal(blockedByGroup(session("10:00", { status: "closed" }), [group]), true);
  // 열려 있거나 신청자가 있으면 해당하지 않는다(그대로 진행하는 회차).
  assert.equal(blockedByGroup(session("14:00"), [group]), false);
  assert.equal(blockedByGroup(session("14:00", { status: "closed", booked_people: 2 }), [group]), false);
  // 다른 날의 단체와는 겹치지 않는다.
  assert.equal(blockedByGroup(session("14:00", { status: "closed" }), [{ ...group, date: "2026-11-29" }]), false);
  assert.equal(blockedByGroup(session("14:00", { status: "closed" }), []), false);
});

test("하루 순서 — 단체 확정 → 진행 확정 회차(파티 · 노말 시간순) → 미확정 → 마감 → 문의 → 빈 회차 → 닫힌 회차", () => {
  const items = [
    { name: "빈 파티 19:30", time: "19:30", rank: sessionRank("party", session("19:30"), [group]) },
    { name: "단체에 막힌 노말 14:00", time: "14:00", rank: sessionRank("normal", session("14:00", { status: "closed" }), [group]) },
    { name: "노말 확정 20:00", time: "20:00", rank: sessionRank("normal", session("20:00", { booked_people: 4, confirmed: 4, paid_confirmed: 4 }), [group]) },
    { name: "단체 문의", time: "11:00", rank: DAY_RANK.inquiry },
    { name: "단체 확정 18:00", time: "18:00", rank: DAY_RANK.group },
    { name: "파티 모집 중 21:00", time: "21:00", rank: sessionRank("party", session("21:00", { booked_people: 2, confirmed: 2 }), [group]) },
    { name: "노말 입금 전 09:00", time: "09:00", rank: sessionRank("normal", session("09:00", { booked_people: 3, confirmed: 3 }), [group]) },
    { name: "단체 확정 13:30", time: "13:30", rank: DAY_RANK.group },
    { name: "비활성화 08:00", time: "08:00", rank: sessionRank("party", session("08:00", { status: "cancelled" }), [group]) },
    { name: "파티 확정 19:00", time: "19:00", rank: sessionRank("party", session("19:00", { booked_people: 8, confirmed: 8, paid_confirmed: 5 }), [group]) },
    { name: "직접 막음", time: "00:00", rank: DAY_RANK.closure },
  ];
  assert.deepEqual(sortDay(items).map((i) => i.name), [
    "단체 확정 13:30",
    "단체 확정 18:00",
    "파티 확정 19:00",
    "노말 확정 20:00",
    "노말 입금 전 09:00",
    "파티 모집 중 21:00",
    "직접 막음",
    "단체 문의",
    "빈 파티 19:30",
    "비활성화 08:00",
    "단체에 막힌 노말 14:00",
  ]);
});
