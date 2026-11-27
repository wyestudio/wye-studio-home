/**
 * 단체 정산 계산 검증 — 관리자 개편 docs/03 7장 「검증용 계산 예시」 를 그대로 옮겼다.
 * 돌리는 법: `npm test`. 요금표 · 규칙을 고치면 여기 기대값도 문서와 같이 고친다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { QUOTE_LAST_DATE, calcQuote, unitPrice } from "@/lib/groupPricing";
import {
  calcSettlement,
  groupRefund,
  requiredDeposit,
  seasonOf,
  settlementUnitPrice,
  studentGap,
  type Adjustment,
  type SettlementOptions,
} from "@/lib/groupSettlement";

const PLAIN: SettlementOptions = { icebreaking: true, character: false, afterPartyHours: 0, cleanup: false };
const settle = (
  date: string,
  headcount: number,
  extra: Partial<{ options: SettlementOptions; studentCount: number | null; adjustments: Adjustment[]; depositPaid: number | null }> = {}
) =>
  calcSettlement({
    date,
    headcount,
    options: extra.options ?? PLAIN,
    studentCount: extra.studentCount ?? null,
    adjustments: extra.adjustments ?? [],
    depositPaid: extra.depositPaid ?? null,
  });

const NEARBY_10: Adjustment = { reason: "nearby", label: "인근 기업 할인", amount: null, pct: 10, sign: -1 };

test("2026-11-28(토) 14명 일반 → 1인 45,000 · 630,000", () => {
  const s = settle("2026-11-28", 14);
  assert.equal(s.unit, 45000);
  assert.equal(s.total, 630000);
});

test("2026-12-03(목) 16명 일반 → 1인 43,000 · 688,000", () => {
  const s = settle("2026-12-03", 16);
  assert.equal(s.unit, 43000);
  assert.equal(s.total, 688000);
});

test("위 건 + 캐릭터 꾸미기 + 인근 기업 할인 10% → 629,200 · 예약금 권장 189,000", () => {
  const s = settle("2026-12-03", 16, { options: { ...PLAIN, character: true }, adjustments: [NEARBY_10] });
  assert.equal(s.base, 688000);
  assert.equal(s.optionsTotal, 10000);
  assert.equal(s.adjustmentsTotal, -68800);
  assert.equal(s.total, 629200);
  assert.equal(s.depositSuggest, 189000);
});

test("2026-12-05(토) 22명 → 23명: 1인 43,000 유지 · 989,000", () => {
  assert.equal(settle("2026-12-05", 22).unit, 43000);
  const s = settle("2026-12-05", 23);
  assert.equal(s.unit, 43000);
  assert.equal(s.total, 989000);
});

test("2026-12-05(토) 14명 → 15명: 구간이 바뀌어 1인 47,000 → 45,000", () => {
  assert.equal(settle("2026-12-05", 14).unit, 47000);
  assert.equal(settle("2026-12-05", 15).unit, 45000);
});

test("2027-02-06(토) 10명 일반 → 1인 45,000 (2월부터 다시 상시 · 주말)", () => {
  assert.equal(seasonOf("2027-02-06").season, "regular");
  assert.equal(settle("2027-02-06", 10).unit, 45000);
});

test("2027-02-10(수) 20명 학생 100% → 1인 35,000 · 700,000", () => {
  const s = settle("2027-02-10", 20, { studentCount: 20 });
  assert.equal(s.allStudentPrice, true);
  assert.equal(s.unit, 35000);
  assert.equal(s.total, 700000);
});

test("2026-12-10(목) 12명 중 학생 8명(67%) → 8 × 41,000 + 4 × 45,000 = 508,000", () => {
  const s = settle("2026-12-10", 12, { studentCount: 8 });
  assert.equal(s.allStudentPrice, false);
  assert.deepEqual(
    s.baseLines.map((l) => l.amount),
    [328000, 180000]
  );
  assert.equal(s.total, 508000);
});

test("학생 80% 규칙 — 상시 평일 12명: 10명(83%)은 전원 학생가 468,000 · 8명(67%)은 484,000 · 10명 중 8명(딱 80%)은 전원 학생가", () => {
  assert.equal(settle("2026-11-25", 12, { studentCount: 10 }).total, 468000);
  assert.equal(settle("2026-11-25", 12, { studentCount: 8 }).total, 484000);
  assert.equal(settle("2026-11-25", 10, { studentCount: 8 }).allStudentPrice, true);
});

test("예약금 146,000 을 받은 뒤 총액이 629,200 으로 바뀌면 잔금 483,200 (예약금은 그대로)", () => {
  const s = settle("2026-12-03", 16, { options: { ...PLAIN, character: true }, adjustments: [NEARBY_10], depositPaid: 146000 });
  assert.equal(s.balance, 483200);
});

test("취소 환불 — 14일 전 전액 · 10일 전 50% · 7일 전 0", () => {
  const at = (today: string) => groupRefund({ depositPaid: 146000, eventDate: "2026-12-15", today }).amount;
  assert.equal(at("2026-12-01"), 146000); // 14일 전
  assert.equal(at("2026-12-02"), 73000); // 13일 전
  assert.equal(at("2026-12-05"), 73000); // 10일 전
  assert.equal(at("2026-12-07"), 73000); // 8일 전
  assert.equal(at("2026-12-08"), 0); // 7일 전
  assert.equal(at("2026-12-15"), 0); // 당일
});

test("25명 — 요금표 없음(별도 상담). 기본요금 0, 총액은 「총액 조정」 줄로 넣는다", () => {
  const s = settle("2026-12-03", 25);
  assert.equal(s.priced, false);
  assert.equal(s.unit, null);
  assert.equal(s.base, 0);
  const fixed = settle("2026-12-03", 25, {
    adjustments: [{ reason: "total_override", label: "총액 조정", amount: 1000000, pct: null, sign: 1 }],
  });
  assert.equal(fixed.total, 1000000);
});

test("옵션 — 레크리에이션 제외 −50,000 · 애프터파티 시간당 50,000(최대 4시간) · 뒷정리는 애프터파티가 있을 때만", () => {
  assert.equal(settle("2026-12-03", 16, { options: { ...PLAIN, icebreaking: false } }).optionsTotal, -50000);
  assert.equal(settle("2026-12-03", 16, { options: { ...PLAIN, afterPartyHours: 9, cleanup: true } }).optionsTotal, 350000);
  assert.equal(settle("2026-12-03", 16, { options: { ...PLAIN, cleanup: true } }).optionsTotal, 0);
});

test("임박 예약(7일 이내) — 계좌이체는 전액, 카드 방식은 예약금 30% 만", () => {
  const base = { total: 629200, eventDate: "2026-12-10" };
  assert.deepEqual(requiredDeposit({ ...base, today: "2026-12-01", payType: "transfer" }), { amount: 189000, full: false }); // 9일 전
  assert.deepEqual(requiredDeposit({ ...base, today: "2026-12-03", payType: "transfer" }), { amount: 629200, full: true }); // 7일 전
  assert.deepEqual(requiredDeposit({ ...base, today: "2026-12-05", payType: "card_balance" }), { amount: 189000, full: false });
  assert.deepEqual(requiredDeposit({ ...base, today: "2026-12-05", payType: "corp_card_full" }), { amount: 189000, full: false });
  // 회사 워크숍은 7일 이내 · 계좌이체여도 예약금 30% 만(2026-11-27 대표님). 회사가 아니면 그대로 전액.
  assert.deepEqual(requiredDeposit({ ...base, today: "2026-12-05", payType: "transfer", company: true }), { amount: 189000, full: false });
  assert.deepEqual(requiredDeposit({ ...base, today: "2026-12-05", payType: "transfer", company: false }), { amount: 629200, full: true });
});

test("학생증 미확인 1인 차액 = 일반가 − 학생가 (평일 4,000 · 주말 2,000)", () => {
  assert.equal(studentGap("2026-12-10", 12), 4000);
  assert.equal(studentGap("2026-12-05", 12), 2000);
  assert.equal(studentGap("2026-12-05", 30), null);
});

test("고객 견적 화면은 그대로 — 2027-01-31 까지만 열리고, 그 뒤 날짜는 자동 견적에 금액이 안 나온다", () => {
  assert.equal(QUOTE_LAST_DATE, "2027-01-31");
  assert.equal(unitPrice("2027-02-06", 10), null);
  assert.equal(calcQuote({ headcount: 10, date: "2027-02-06", time: "15:30", options: PLAIN }).total, null);
  // 같은 날짜 · 인원이면 견적과 정산의 일반가가 같다(요금표가 한 벌이다).
  for (const [d, n] of [["2026-11-28", 14], ["2026-12-03", 16], ["2027-01-31", 6], ["2026-12-25", 24]] as const) {
    assert.equal(unitPrice(d, n), settlementUnitPrice(d, n, "general"));
  }
});
