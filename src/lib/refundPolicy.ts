/**
 * 취소·환불 규정 — 한 곳에서만 정의한다.
 *
 * 화면·문자·약관이 각자 문구를 들고 있으면 규정이 바뀔 때 반드시 한 군데가
 * 남는다(실제로 그랬다 — 48/24시간 문구가 다섯 곳에 흩어져 있었다).
 *
 * ⚠️ 시(hour)가 아니라 **날짜(day)** 로 센다.
 *    예전에는 "시작 48시간 전"처럼 시각으로 계산해, 같은 '이틀 전'이라도 회차
 *    시각이 11:30이냐 19:30이냐에 따라 결과가 달랐다. 고객은 날짜로 생각한다.
 *    KST 캘린더 날짜끼리 빼서 판정한다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 자정으로 맞춘 ms. 날짜 차이만 필요할 때 쓴다. */
function kstMidnightMs(input: Date): number {
  const shifted = new Date(input.getTime() + KST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/** 오늘(KST)로부터 회차일까지 남은 날 수. 당일이면 0, 어제였으면 음수. */
export function daysUntilSession(startAt: string, now: Date = new Date()): number {
  const diff = kstMidnightMs(new Date(startAt)) - kstMidnightMs(now);
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

/**
 * 테마마다 고르는 환불 규정(themes.refund_policy).
 *   standard  파티모드 등 — 4일 전까지 100% / 3일 전 50% / 2일 전부터 불가
 *   normal    노말모드   — 3일 전까지 100% / 2일 전 50% / 1일 전부터 불가 (2026-10-18 대표님 확정)
 *
 * ⚠️ 값을 늘리면 DB 제약(themes_refund_policy_chk)과 이용약관 제8조도 같이 고친다.
 */
export type RefundPolicy = "standard" | "normal";

/** DB 에서 읽은 값. 모르는 값·비어 있음은 standard 로 본다 — 더 엄격한 쪽이다. */
export function toRefundPolicy(v: unknown): RefundPolicy {
  return v === "normal" ? "normal" : "standard";
}

/** 남은 날 수에 따른 환불 비율 (0 ~ 1). */
export function refundRate(
  startAt: string,
  now: Date = new Date(),
  policy: RefundPolicy = "standard"
): number {
  const days = daysUntilSession(startAt, now);
  if (policy === "normal") {
    if (days >= 3) return 1;
    if (days === 2) return 0.5;
    return 0;
  }
  if (days >= 4) return 1;
  if (days === 3) return 0.5;
  return 0;
}

export function calculateRefundAmount(
  startAt: string,
  totalKrw: number,
  now: Date = new Date(),
  policy: RefundPolicy = "standard"
): number {
  return Math.round(totalKrw * refundRate(startAt, now, policy));
}

type RefundTier = { when: string; result: string; tone: "ok" | "warn" | "danger" };

/**
 * 화면에 보여주는 환불 단계. 이용약관 제8조 제1항과 **같은 문장**을 쓴다 —
 * 요약하려고 줄이면 경계(그날 몇 시까지인지)가 흐려져 분쟁이 난다.
 */
const TIERS: Record<RefundPolicy, RefundTier[]> = {
  standard: [
    { when: "진행일 4일 전 23:59까지", result: "100% 환불", tone: "ok" },
    { when: "진행일 3일 전 23:59까지", result: "50% 환불", tone: "warn" },
    { when: "진행일 2일 전 00:00 이후", result: "환불 불가", tone: "danger" },
  ],
  normal: [
    { when: "진행일 3일 전 23:59까지", result: "100% 환불", tone: "ok" },
    { when: "진행일 2일 전 23:59까지", result: "50% 환불", tone: "warn" },
    { when: "진행일 1일 전 00:00 이후", result: "환불 불가", tone: "danger" },
  ],
};

export function refundTiers(policy: RefundPolicy = "standard"): RefundTier[] {
  return TIERS[policy];
}

/** 예전 이름. 파티(standard) 규정이다. */
export const REFUND_TIERS = TIERS.standard;

export function refundPolicySms(policy: RefundPolicy = "standard"): string {
  const full = (r: string) => (r === "100% 환불" ? "전액 환불" : r);
  return TIERS[policy].map((t) => `· ${t.when} 취소: ${full(t.result)}`).join("\n");
}

export const REFUND_POLICY_SMS = refundPolicySms("standard");
