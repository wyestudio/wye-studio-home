/**
 * 단체 예약 **정산** — 관리자가 확정한 금액(관리자 개편 docs/03).
 *
 * groupPricing.ts 의 calcQuote 는 고객 견적 화면의 **자동 견적**이다(일반가 · 2027-01-31 까지 · 애프터파티 규칙 강제).
 * 이 파일은 그 위에 관리자만 쓰는 것을 얹는다: 학생 단체 특가(80% 규칙) · 2027-02 이후 상시 요금 · 조정 줄 ·
 * 예약금 권장액 · 잔금 · 단체 취소 환불 규정. 요금표 · 옵션 금액은 groupPricing.ts 의 값을 그대로 읽는다
 * (두 곳에 따로 적으면 견적과 정산이 갈린다).
 *
 * ⚠️ 금액은 **서버가 이 파일로 다시 계산**한다. 화면이 보낸 금액을 믿지 않는다. DB 에는 계산의 재료
 *    (인원 · 날짜 · 옵션 · 학생 인원 · 조정 줄 · 받은 예약금)만 저장하고 총액은 저장하지 않는다.
 * ⚠️ 이 파일은 "use client" 화면도 import 한다 — 감출 값을 적지 않는다(전부 고객에게 안내하는 금액이다).
 * ⚠️ 파티 · 노말 예약의 환불 규정(refundPolicy.ts)과 **다르다.** 섞지 않는다.
 */
import {
  BASE_MINUTES,
  DEPOSIT_RATE,
  GROUP_RATES,
  OPTION,
  SEASON_PERIODS,
  bandIndex,
  isWeekend,
  type RateKind,
  type RateSeason,
} from "@/lib/groupPricing";

/** 이용일의 시기(상시 · 성수기). */
export function seasonOf(date: string): { season: RateSeason; label: string } {
  const p = SEASON_PERIODS.find((x) => x.until === null || date <= x.until)!;
  return { season: p.season, label: p.label };
}

/** 1인 요금. 요금표 밖 인원(6~24명 밖)이면 null — 별도 상담. */
export function settlementUnitPrice(date: string, headcount: number, kind: RateKind): number | null {
  const band = bandIndex(headcount);
  if (band == null) return null;
  const table = GROUP_RATES[kind][seasonOf(date).season];
  return (isWeekend(date) ? table.weekend : table.weekday)[band];
}

/** 학생 단체 — 참가자의 이 비율 이상이 학생이면 전원 학생가(안내 이미지). */
export const STUDENT_ALL_RATIO = 0.8;

/** 관리자가 고르는 옵션. 고객 견적과 달리 주말 다른 회차의 애프터파티도 운영자 판단으로 넣을 수 있다. */
export type SettlementOptions = {
  icebreaking: boolean;
  character: boolean;
  /** 0~4. 4시간 초과는 별도 상담 — 금액은 조정 줄로 넣는다. */
  afterPartyHours: number;
  /** 애프터파티가 있을 때만 유효. */
  cleanup: boolean;
};

/** 조정 줄의 사유. DB 제약(group_booking_adjustments.reason_code)과 같은 목록이다. */
export const ADJUST_REASONS = [
  { code: "nearby", label: "인근 기업" },
  { code: "special", label: "특별 할인" },
  { code: "headcount", label: "인원 변경" },
  { code: "student_unverified", label: "학생증 미확인 차액" },
  { code: "total_override", label: "총액 조정" },
  { code: "etc", label: "기타" },
] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number]["code"];
export const isAdjustReason = (v: string): v is AdjustReason => ADJUST_REASONS.some((r) => r.code === v);
/** 할인 사유 — 학생 특가와 같이 쓰면 "중복 적용 불가" 경고를 띄운다(막지는 않는다. 2026-11-27 대표님). */
export const DISCOUNT_REASONS: readonly AdjustReason[] = ["nearby", "special"];

/** 조정 한 줄. 금액(원) 또는 기본요금의 %, 더하기(+1) / 빼기(-1). */
export type Adjustment = {
  reason: AdjustReason;
  label: string;
  /** 정액(원). pct 와 둘 중 하나만. */
  amount: number | null;
  /** 기본요금의 %. 0 초과 100 이하. */
  pct: number | null;
  sign: 1 | -1;
};

export const MONEY_MAX = 100_000_000;

/** 조정 줄이 규칙에 맞나. 맞으면 null, 아니면 안내 문구. */
export function adjustmentError(a: Adjustment): string | null {
  if (!isAdjustReason(a.reason)) return "조정 사유를 골라주세요.";
  if (a.sign !== 1 && a.sign !== -1) return "더하기 · 빼기를 골라주세요.";
  if ((a.amount == null) === (a.pct == null)) return "금액과 % 중 하나만 넣어주세요.";
  if (a.amount != null && !(Number.isInteger(a.amount) && a.amount >= 1 && a.amount <= MONEY_MAX)) {
    return "금액은 1원 ~ 1억 원 사이 정수로 넣어주세요.";
  }
  if (a.pct != null && !(a.pct > 0 && a.pct <= 100)) return "%는 0 초과 100 이하로 넣어주세요.";
  return null;
}

export type SettlementLine = { label: string; detail?: string; amount: number };

export type Settlement = {
  /** 요금표가 있는 인원인가(6~24명). 아니면 기본요금 0 — 상담한 금액을 「총액 조정」 줄로 넣는다. */
  priced: boolean;
  season: RateSeason;
  seasonLabel: string;
  weekend: boolean;
  /** 대표 1인 요금 — 전원 한 요금일 때. 학생 · 일반이 섞이면 일반가. 요금표 밖이면 null. */
  unit: number | null;
  /** 전원 학생가로 계산했나(학생 비율 80% 이상). */
  allStudentPrice: boolean;
  /** 기본 프로그램 줄(학생 · 일반이 섞이면 두 줄). */
  baseLines: SettlementLine[];
  base: number;
  optionLines: SettlementLine[];
  optionsTotal: number;
  adjustmentLines: SettlementLine[];
  adjustmentsTotal: number;
  total: number;
  /** 예약금 권장액 = 할인 후 총액의 30%, 천 원 단위 반올림. */
  depositSuggest: number;
  /** 잔금 = 총액 − 실제 받은 예약금. 예약금을 안 받았으면 총액. */
  balance: number;
  /** 진행 시간(분) — 기본 180, 레크리에이션을 빼면 150, 애프터파티 시간을 더한다. */
  minutes: number;
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function calcSettlement(input: {
  date: string;
  headcount: number;
  options: SettlementOptions;
  /** 학생 단체면 학생 인원. 아니면 null. */
  studentCount: number | null;
  adjustments: readonly Adjustment[];
  /** 실제 받은 예약금. 아직이면 null. */
  depositPaid: number | null;
}): Settlement {
  const { date, headcount } = input;
  const { season, label: seasonLabel } = seasonOf(date);
  const general = settlementUnitPrice(date, headcount, "general");
  const student = settlementUnitPrice(date, headcount, "student");
  const priced = general != null && student != null;

  // ── 기본요금 ── 구간은 전체 인원으로 정하고, 학생 비율로 학생가 적용 범위를 정한다.
  const baseLines: SettlementLine[] = [];
  let allStudentPrice = false;
  let unit: number | null = general;
  if (priced) {
    const students = input.studentCount == null ? 0 : Math.max(0, Math.min(headcount, Math.trunc(input.studentCount)));
    if (input.studentCount != null && students / headcount >= STUDENT_ALL_RATIO) {
      allStudentPrice = true;
      unit = student;
      baseLines.push({ label: "기본 프로그램 (학생 단체)", detail: `${won(student)} × ${headcount}명`, amount: student * headcount });
    } else if (input.studentCount != null && students > 0) {
      baseLines.push({ label: "기본 프로그램 (학생)", detail: `${won(student)} × ${students}명`, amount: student * students });
      baseLines.push({
        label: "기본 프로그램 (일반)",
        detail: `${won(general)} × ${headcount - students}명`,
        amount: general * (headcount - students),
      });
    } else {
      baseLines.push({ label: "기본 프로그램", detail: `${won(general)} × ${headcount}명`, amount: general * headcount });
    }
  }
  const base = baseLines.reduce((s, l) => s + l.amount, 0);

  // ── 옵션 ── 금액은 groupPricing.ts 의 OPTION 그대로(단체 1회 기준).
  const o = input.options;
  const hours = Math.max(0, Math.min(OPTION.afterParty.maxHours, Math.trunc(o.afterPartyHours || 0)));
  const optionLines: SettlementLine[] = [];
  if (!o.icebreaking) optionLines.push({ label: "레크리에이션 제외", detail: "30분 단축", amount: -OPTION.icebreaking.discount });
  if (o.character) optionLines.push({ label: "캐릭터 꾸미기", amount: OPTION.character.price });
  if (hours > 0) optionLines.push({ label: "애프터파티", detail: `${hours}시간`, amount: hours * OPTION.afterParty.hourly });
  if (hours > 0 && o.cleanup) optionLines.push({ label: "뒷정리 서비스", amount: OPTION.cleanup.price });
  const optionsTotal = optionLines.reduce((s, l) => s + l.amount, 0);

  // ── 조정 ── 정액은 그대로, %는 기본요금 × % 를 원 단위 반올림.
  const adjustmentLines: SettlementLine[] = input.adjustments.map((a) => {
    const raw = a.amount != null ? a.amount : Math.round((base * (a.pct ?? 0)) / 100);
    return { label: a.label, detail: a.pct != null ? `기본요금의 ${a.pct}%` : undefined, amount: a.sign * raw };
  });
  const adjustmentsTotal = adjustmentLines.reduce((s, l) => s + l.amount, 0);

  const total = base + optionsTotal + adjustmentsTotal;
  return {
    priced,
    season,
    seasonLabel,
    weekend: isWeekend(date),
    unit: priced ? unit : null,
    allStudentPrice,
    baseLines,
    base,
    optionLines,
    optionsTotal,
    adjustmentLines,
    adjustmentsTotal,
    total,
    depositSuggest: depositSuggest(total),
    balance: total - (input.depositPaid ?? 0),
    minutes: BASE_MINUTES - (o.icebreaking ? 0 : OPTION.icebreaking.minutes) + hours * 60,
  };
}

/** 예약금 권장액 — 할인 **후** 총액의 30%, 천 원 단위(100원 자리 반올림). calcQuote 와 같은 식이다. */
export function depositSuggest(total: number): number {
  return Math.round((total * DEPOSIT_RATE) / 1000) * 1000;
}

/** 'YYYY-MM-DD' 두 날짜 사이의 날 수(to − from). KST 달력 날짜 기준이라 시각은 보지 않는다. */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** 결제 방식. DB 제약(group_booking_inquiries.pay_type)과 같은 목록이다. */
export const PAY_TYPES = [
  { code: "transfer", label: "잔금 계좌이체" },
  { code: "card_balance", label: "잔금만 카드 (행사 당일)" },
  { code: "corp_card_full", label: "예약금 환불 후 전액 법인카드" },
] as const;
export type PayType = (typeof PAY_TYPES)[number]["code"];
export const isPayType = (v: string): v is PayType => PAY_TYPES.some((p) => p.code === v);

/** 이 날 수 이내로 남은 행사는 '임박 예약' 이다 — 확정에 필요한 입금액이 달라진다. */
export const LATE_BOOKING_DAYS = 7;

/**
 * 지금 입금받아 확정하려면 얼마를 받아야 하나(2026-11-27 대표님).
 *
 *   행사까지 7일 넘게 남음            → 예약금 30%
 *   7일 이내 + 계좌이체               → **전액**(확정 인원 기준 전액 결제 시 확정)
 *   7일 이내 + 카드(잔금 카드 · 법인카드) → 예약금 30% 만 — 당일 현장에서 카드로 결제하기 때문이다
 *     (법인카드는 당일 예약금을 돌려주고 총액을 카드로 받는 경우가 많다)
 *   7일 이내 + **회사 워크숍**          → 결제 방식과 상관없이 예약금 30% 만(2026-11-27 대표님) —
 *     회사는 예약금을 넣고 당일에 돌려받은 뒤 전액 카드로 결제하는 경우가 많아, 평소와 같은 안내가 나간다
 *
 * 받은 돈은 어느 경우든 '예약금' 으로 기록한다. 전액을 받았으면 잔금이 0 이 된다.
 */
export function requiredDeposit(input: { total: number; eventDate: string; today: string; payType: PayType; company?: boolean }): {
  amount: number;
  full: boolean;
} {
  const late = daysBetween(input.today, input.eventDate) <= LATE_BOOKING_DAYS;
  if (late && input.payType === "transfer" && !input.company) return { amount: input.total, full: true };
  return { amount: depositSuggest(input.total), full: false };
}

/**
 * 단체 취소 환불(docs/03 5장) — 행사일까지 남은 날(KST 날짜) 기준, **받은 예약금**에 대해.
 *   14일 전까지 전액 · 13~8일 전 50%(원 단위 반올림) · 7일 전부터 환불 불가.
 * 취소 화면 · 금액 탭의 "오늘 취소하면" · 모임장 신청서의 규정 동의가 모두 이 함수를 쓴다.
 */
export const GROUP_REFUND_RULES = [
  { minDays: 14, rate: 1, label: "전액 환불", range: "행사 14일 전까지" },
  { minDays: 8, rate: 0.5, label: "예약금의 50% 환불", range: "행사 13~8일 전" },
  { minDays: -Infinity, rate: 0, label: "환불 불가", range: "행사 7일 전부터" },
] as const;

export function groupRefund(input: { depositPaid: number; eventDate: string; today: string }): {
  daysLeft: number;
  rate: number;
  amount: number;
  label: string;
  range: string;
} {
  const daysLeft = daysBetween(input.today, input.eventDate);
  const rule = GROUP_REFUND_RULES.find((r) => daysLeft >= r.minDays)!;
  return { daysLeft, rate: rule.rate, amount: Math.round(input.depositPaid * rule.rate), label: rule.label, range: rule.range };
}

/** 학생증 미확인 인원의 1인 차액(일반가 − 학생가). 요금표 밖이면 null. */
export function studentGap(date: string, headcount: number): number | null {
  const g = settlementUnitPrice(date, headcount, "general");
  const s = settlementUnitPrice(date, headcount, "student");
  return g == null || s == null ? null : g - s;
}
