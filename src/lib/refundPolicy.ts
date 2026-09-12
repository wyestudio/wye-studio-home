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

/** 남은 날 수에 따른 환불 비율 (0 ~ 1). */
export function refundRate(startAt: string, now: Date = new Date()): number {
  const days = daysUntilSession(startAt, now);
  if (days >= 4) return 1;
  if (days === 3) return 0.5;
  return 0;
}

export function calculateRefundAmount(
  startAt: string,
  totalKrw: number,
  now: Date = new Date()
): number {
  return Math.round(totalKrw * refundRate(startAt, now));
}

/** 화면에 늘어놓을 규정 3줄. 순서 그대로 쓴다. */
/**
 * 화면에 보여주는 환불 단계. 이용약관 제8조 제1항과 **같은 문장**을 쓴다 —
 * 요약하려고 줄이면 경계(그날 몇 시까지인지)가 흐려져 분쟁이 난다.
 */
export const REFUND_TIERS = [
  { when: "행사일 4일 전 23:59까지", result: "100% 환불", tone: "ok" as const },
  { when: "행사일 3일 전 23:59까지", result: "50% 환불", tone: "warn" as const },
  { when: "행사일 2일 전 00:00 이후", result: "환불 불가", tone: "danger" as const },
];

export const REFUND_POLICY_SMS = [
  "· 행사일 4일 전 23:59까지 취소: 전액 환불",
  "· 행사일 3일 전 23:59까지 취소: 50% 환불",
  "· 행사일 2일 전 00:00 이후 취소: 환불 불가",
].join("\n");
