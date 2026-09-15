import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundRate } from "@/lib/refundPolicy";

/**
 * 제휴 정산 — 잼핏(ZAMFIT) 성과형 예약 수수료.
 *
 * 계약서: 「잼핏 입점 및 성과형 예약연동 제휴계약서」(2026-09-15 ~ 2026-12-15)
 *
 * ⚠️ 여기 숫자가 그대로 상대 회사에 지급할 금액이 된다. 규칙을 바꾸기 전에
 *    반드시 계약 조항을 다시 읽을 것. 계약 제16조는 **매출·정산자료를 고의로
 *    누락하면 즉시 해지 + 마케팅비 청구** 라고 정하고 있다.
 *
 * ── 정산 대상 (제8조 2항) ──────────────────────────────────
 *   · 잼핏 전용 쿠폰이 사용된 예약        → applications.coupon_id 로 판정
 *   · 실제 예약대금의 입금이 완료된 예약  → paid_at is not null
 *   · 해당 월 말일까지 전액 환불되지 않은 예약
 *
 * ⚠️ **취소됐다고 무조건 빼면 안 된다.** 제7조 8항:
 *      "예약금액의 일부가 환불된 경우에는 을이 최종적으로 보유하는 금액을
 *       기준으로 수수료를 다시 계산한다"
 *    우리 환불 규정은 날짜 기준 100% / 50% / 0% 다(refundPolicy.ts).
 *    3일 전 취소(50% 환불)나 2일 전 취소(환불 불가)는 **우리가 돈을 보유하므로
 *    수수료가 발생한다.** status <> 'cancelled' 로 거르면 잼핏에 줄 돈을
 *    누락하는 것이고, 그것이 곧 제16조의 해지 사유다.
 *
 * ⚠️ 쿠폰 사용 여부는 **applications.coupon_id** 로 본다. coupons.used_at 이
 *    아니다 — 취소되면 쿠폰이 풀리면서(p21) used_at 이 null 로 돌아가기 때문에,
 *    쿠폰 테이블 기준으로 세면 취소 건이 통째로 사라진다.
 *
 * ⚠️ 개인정보(이름·연락처)는 넣지 않는다. 제8조 4항·제14조 3항이
 *    "예약번호·쿠폰 사용 여부·인원·결제금액·취소여부 등 최소한의 정보"로 제한한다.
 */

/** 수수료율. 제7조 1항 — 실입금액의 5% (부가세 포함). 변경은 서면 합의 사항이다. */
export const COMMISSION_RATE = 0.05;

/** 정산 대상 캠페인을 고르는 기준. 이름 앞이 '잼핏' 인 캠페인. */
export const PARTNER_CAMPAIGN_PREFIX = "잼핏";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 'YYYY-MM' → 그 달의 KST 시작/끝(다음 달 1일 00:00)의 UTC ISO */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1) - KST_OFFSET_MS;
  const end = Date.UTC(y, m, 1) - KST_OFFSET_MS;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export type SettlementRow = {
  confirmationCode: string;
  themeName: string;
  /** KST 'YYYY-MM-DD HH:mm' */
  sessionLabel: string;
  headcount: number;
  couponCode: string | null;
  discountKrw: number;
  /** 고객이 실제로 입금한 금액 */
  paidKrw: number;
  cancelled: boolean;
  /** 취소 건의 환불 비율 (0 / 0.5 / 1). 미취소면 null */
  refundRatio: number | null;
  /** 우리가 최종 보유하는 금액 — 수수료의 기준 (제7조 8항) */
  retainedKrw: number;
  commissionKrw: number;
  utmSource: string | null;
  /** 사람이 한 번 봐야 하는 건 (규정과 다르게 환불했을 수 있음) */
  needsReview: boolean;
};

export type SettlementResult = {
  month: string;
  rows: SettlementRow[];
  totals: { count: number; headcount: number; retainedKrw: number; commissionKrw: number };
  /** 이전 달 정산분인데 이번 달에 취소돼 차감이 필요한 건 (제7조 9항) */
  deductions: SettlementRow[];
};

const EMPTY_TOTALS = { count: 0, headcount: 0, retainedKrw: 0, commissionKrw: 0 };

type Raw = {
  confirmation_code: string;
  headcount: number;
  amount_krw: number;
  discount_krw: number | null;
  paid_at: string | null;
  cancelled_at: string | null;
  refund_completed_at: string | null;
  status: string;
  utm_source: string | null;
  created_at: string;
  coupons: { code: string } | null;
  sessions: { start_at: string; themes: { name: string } | null } | null;
};

function kstLabel(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

/**
 * 한 건의 보유액을 계산한다.
 *
 * 환불 비율은 **취소 시점**과 회차 시작일의 날짜 차이로 정해진다(refundPolicy.ts).
 * 환불 금액을 따로 저장하는 칸이 없어서 규정대로 계산한다 —
 * 규정과 다르게 환불한 건이 있으면 needsReview 로 표시해 사람이 확인하게 한다.
 */
function settleOne(r: Raw): SettlementRow {
  const paid = r.amount_krw ?? 0;
  const cancelled = r.status === "cancelled" || r.cancelled_at !== null;

  let ratio: number | null = null;
  let retained = paid;
  if (cancelled && r.sessions?.start_at) {
    ratio = refundRate(r.sessions.start_at, new Date(r.cancelled_at ?? r.created_at));
    retained = Math.round(paid * (1 - ratio));
  } else if (cancelled) {
    // 회차 정보를 못 읽은 취소 건. 임의로 판단하지 않고 사람에게 넘긴다.
    ratio = null;
    retained = 0;
  }

  return {
    confirmationCode: r.confirmation_code,
    themeName: r.sessions?.themes?.name ?? "(테마 없음)",
    sessionLabel: r.sessions?.start_at ? kstLabel(r.sessions.start_at) : "-",
    headcount: r.headcount ?? 1,
    couponCode: r.coupons?.code ?? null,
    discountKrw: r.discount_krw ?? 0,
    paidKrw: paid,
    cancelled,
    refundRatio: ratio,
    retainedKrw: retained,
    commissionKrw: Math.round(retained * COMMISSION_RATE),
    utmSource: r.utm_source,
    // 환불 처리는 했는데 규정상 100% 환불이 아닌 건 = 금액을 손으로 정했을 수 있다
    needsReview: cancelled && (ratio === null || (r.refund_completed_at !== null && ratio !== 1)),
  };
}

const SELECT =
  "confirmation_code, headcount, amount_krw, discount_krw, paid_at, cancelled_at, " +
  "refund_completed_at, status, utm_source, created_at, " +
  "coupons!inner(code, coupon_campaigns!inner(name)), " +
  "sessions(start_at, themes(name))";

export async function getSettlement(month: string): Promise<SettlementResult> {
  const supabase = createAdminClient();
  const { start, end } = monthRange(month);

  // 이번 달 신청분 (제8조 2항 — 정산기간 중 발생한 예약)
  const { data, error } = await supabase
    .from("applications")
    .select(SELECT)
    .like("coupons.coupon_campaigns.name", `${PARTNER_CAMPAIGN_PREFIX}%`)
    .not("paid_at", "is", null)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at");

  if (error) {
    console.error("[settlement] 조회 실패", error);
    return { month, rows: [], totals: EMPTY_TOTALS, deductions: [] };
  }

  // 전액 환불된 건은 보유액이 0이라 수수료가 없다(제7조 6항).
  // 목록에는 남겨 둔다 — "왜 빠졌는지" 를 보여줘야 정산 근거가 된다.
  const rows = (data as unknown as Raw[]).map(settleOne);

  const totals = rows.reduce(
    (a, r) => ({
      count: a.count + (r.retainedKrw > 0 ? 1 : 0),
      headcount: a.headcount + (r.retainedKrw > 0 ? r.headcount : 0),
      retainedKrw: a.retainedKrw + r.retainedKrw,
      commissionKrw: a.commissionKrw + r.commissionKrw,
    }),
    { ...EMPTY_TOTALS }
  );

  // 제7조 9항 — 이전 달에 정산한 건이 이번 달에 취소되면 차기 정산에서 차감한다.
  const { data: prev } = await supabase
    .from("applications")
    .select(SELECT)
    .like("coupons.coupon_campaigns.name", `${PARTNER_CAMPAIGN_PREFIX}%`)
    .not("paid_at", "is", null)
    .lt("created_at", start)
    .gte("cancelled_at", start)
    .lt("cancelled_at", end)
    .order("cancelled_at");

  const deductions = ((prev ?? []) as unknown as Raw[]).map(settleOne);

  return { month, rows, totals, deductions };
}
