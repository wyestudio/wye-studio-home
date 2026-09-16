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
 *   · 잼핏 전용 쿠폰이 사용된 예약        → application_coupons 로 판정
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
 * ⚠️ 쿠폰 사용 여부는 **application_coupons** 로 본다.
 *    · coupons.used_at 이 아니다 — 취소되면 쿠폰이 풀리면서(p21) used_at 이 null 로
 *      돌아가기 때문에, 쿠폰 테이블 기준으로 세면 취소 건이 통째로 사라진다.
 *    · applications.coupon_id 도 아니다 — 쿠폰 중복 적용(p37)이 되면서 그 칸은
 *      더 이상 쓰지 않는다. 잼핏+인스타를 같이 쓴 건을 놓치게 된다.
 *    application_coupons 는 코드·캠페인명·할인액을 문자열로 박아 두므로,
 *    나중에 쿠폰이나 캠페인이 지워져도 정산 근거가 남는다.
 *
 * ⚠️ 개인정보(이름·연락처)는 넣지 않는다. 제8조 4항·제14조 3항이
 *    "예약번호·쿠폰 사용 여부·인원·결제금액·취소여부 등 최소한의 정보"로 제한한다.
 */

/** 수수료율. 제7조 1항 — 실입금액의 5% (부가세 포함). 변경은 서면 합의 사항이다. */
export const COMMISSION_RATE = 0.05;

/**
 * 쿠폰 할인비용 중 **잼핏이 부담하는 비율**. 제6조 3항 — 갑 50% / 을 50%.
 *
 * ⚠️ 이 금액만큼 우리가 잼핏에게 받을 돈이 있다. 제6조 4항은 이를 수수료
 *    정산금액과 **상계할 수 있다**고 정한다("양 당사자의 동의 하에").
 *    합의 전이라면 상계하지 말고 수수료 전액을 지급한 뒤 따로 청구해야 한다 —
 *    화면에서 두 금액을 나눠 보여주는 이유다.
 */
export const PARTNER_COUPON_SHARE = 0.5;

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
  /** 이 건에 붙은 잼핏 쿠폰 코드 */
  couponCode: string | null;
  /** 이 건에 붙은 모든 쿠폰 (잼핏 + 다른 이벤트 쿠폰) */
  allCoupons: string;
  /** 모든 쿠폰을 합친 할인액 */
  discountKrw: number;
  /** ⚠️ **잼핏 쿠폰만의** 할인액. 비용 50% 분담(제6조)의 기준은 이것이다.
   *     총 할인액을 쓰면 인스타 이벤트 쿠폰까지 잼핏에 청구하게 된다. */
  partnerDiscountKrw: number;
  /** 고객이 실제로 입금한 금액 */
  paidKrw: number;
  cancelled: boolean;
  /** 취소 건의 환불 비율 (0 / 0.5 / 1). 미취소면 null */
  refundRatio: number | null;
  /** 우리가 최종 보유하는 금액 — 수수료의 기준 (제7조 8항) */
  retainedKrw: number;
  commissionKrw: number;
  /** 이 건의 할인액 중 잼핏이 부담하는 몫 (제6조 3항). 우리가 받을 돈이다. */
  partnerCouponShareKrw: number;
  utmSource: string | null;
  /** 사람이 한 번 봐야 하는 건 (규정과 다르게 환불했을 수 있음) */
  needsReview: boolean;
};

export type SettlementResult = {
  month: string;
  rows: SettlementRow[];
  totals: {
    count: number;
    headcount: number;
    retainedKrw: number;
    commissionKrw: number;
    /** 잼핏이 부담할 쿠폰 비용 합계 (제6조 3항) */
    partnerCouponShareKrw: number;
  };
  /** 이전 달 정산분인데 이번 달에 취소돼 차감이 필요한 건 (제7조 9항) */
  deductions: SettlementRow[];
};

const EMPTY_TOTALS = { count: 0, headcount: 0, retainedKrw: 0, commissionKrw: 0, partnerCouponShareKrw: 0 };

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
  application_coupons: { code: string; campaign_name: string; discount_krw: number }[] | null;
  sessions: { start_at: string; theme_id: string | null } | null;
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
function settleOne(r: Raw, themeNames: Map<string, string>): SettlementRow {
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

  const partner = partnerCoupon(r);
  const coupons = r.application_coupons ?? [];

  return {
    confirmationCode: r.confirmation_code,
    themeName: (r.sessions?.theme_id && themeNames.get(r.sessions.theme_id)) || "(테마 없음)",
    sessionLabel: r.sessions?.start_at ? kstLabel(r.sessions.start_at) : "-",
    headcount: r.headcount ?? 1,
    couponCode: partner?.code ?? null,
    allCoupons: coupons.map((c) => `${c.campaign_name} ${c.code}`).join(" + "),
    discountKrw: r.discount_krw ?? 0,
    partnerDiscountKrw: partner?.discount_krw ?? 0,
    paidKrw: paid,
    cancelled,
    refundRatio: ratio,
    retainedKrw: retained,
    commissionKrw: Math.round(retained * COMMISSION_RATE),
    // ⚠️ **잼핏 쿠폰 할인액**에만 50% 를 매긴다(제6조 3항). 다른 이벤트 쿠폰은
    //    우리가 전액 부담하므로 잼핏에 청구할 수 없다.
    //    전액 환불된 건은 고객이 할인을 누린 것이 없으므로 분담도 없다.
    partnerCouponShareKrw:
      retained > 0 ? Math.round((partner?.discount_krw ?? 0) * PARTNER_COUPON_SHARE) : 0,
    utmSource: r.utm_source,
    // 환불 처리는 했는데 규정상 100% 환불이 아닌 건 = 금액을 손으로 정했을 수 있다
    needsReview: cancelled && (ratio === null || (r.refund_completed_at !== null && ratio !== 1)),
  };
}

/*
  ⚠️ 캠페인 이름으로 **중첩 필터를 걸지 않는다.**
     `.like("...coupon_campaigns.name", ...)` 를 쓰면 PostgREST 가 오류 없이
     0건을 돌려주는 경우가 있다(2026-09-15 실제로 겪음). 정산에서 0건은
     "줄 돈이 없다"로 읽히므로, 조용히 틀리는 쪽이 에러보다 훨씬 위험하다.
     쿠폰을 쓴 신청은 많아야 수백 건이라 전부 받아서 코드에서 거른다.

  ⚠️ 테마 이름을 중첩으로 끌어오지 않는다. 3단 임베드는 값이 조용히 비어 올 수
     있어, 테마는 따로 받아서 코드에서 붙인다.
*/
const SELECT =
  "confirmation_code, headcount, amount_krw, discount_krw, paid_at, cancelled_at, " +
  "refund_completed_at, status, utm_source, created_at, " +
  "application_coupons(code, campaign_name, discount_krw), " +
  "sessions(start_at, theme_id)";

/** 잼핏 캠페인 쿠폰이 **한 장이라도** 붙어 있으면 정산 대상이다. */
function isPartner(r: Raw): boolean {
  return (r.application_coupons ?? []).some((c) =>
    (c.campaign_name ?? "").startsWith(PARTNER_CAMPAIGN_PREFIX)
  );
}

/** 이 건에 붙은 잼핏 쿠폰 한 장. 캠페인당 1장이므로 하나뿐이다. */
function partnerCoupon(r: Raw) {
  return (r.application_coupons ?? []).find((c) =>
    (c.campaign_name ?? "").startsWith(PARTNER_CAMPAIGN_PREFIX)
  );
}

/** 테마 id → 이름. 테마는 몇 개뿐이라 통째로 받아 쓴다. */
async function loadThemeNames(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("themes").select("id, name");
  if (error) {
    console.error("[settlement] 테마 이름 조회 실패", error);
    return new Map();
  }
  return new Map((data ?? []).map((t) => [t.id as string, t.name as string]));
}

export async function getSettlement(month: string): Promise<SettlementResult> {
  const supabase = createAdminClient();
  const { start, end } = monthRange(month);

  // 이번 달 신청분 (제8조 2항 — 정산기간 중 발생한 예약)
  const { data, error } = await supabase
    .from("applications")
    .select(SELECT)
    // ⚠️ 쿠폰 유무를 DB 에서 거르지 않는다. 임베드에 !inner 를 걸면 조용히 0건이
    //    될 수 있어서(2026-09-15), 한 달치를 받아 isPartner 로 거른다.
    .not("paid_at", "is", null)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at");

  if (error) {
    // ⚠️ 삼켜서 0건으로 보여주면 안 된다. 화면이 실패를 드러내야 한다.
    console.error("[settlement] 조회 실패", error);
    throw new Error(`정산 자료를 불러오지 못했습니다: ${error.message}`);
  }

  // 전액 환불된 건은 보유액이 0이라 수수료가 없다(제7조 6항).
  // 목록에는 남겨 둔다 — "왜 빠졌는지" 를 보여줘야 정산 근거가 된다.
  const themeNames = await loadThemeNames(supabase);
  const rows = (data as unknown as Raw[]).filter(isPartner).map((r) => settleOne(r, themeNames));

  const totals = rows.reduce(
    (a, r) => ({
      count: a.count + (r.retainedKrw > 0 ? 1 : 0),
      headcount: a.headcount + (r.retainedKrw > 0 ? r.headcount : 0),
      retainedKrw: a.retainedKrw + r.retainedKrw,
      commissionKrw: a.commissionKrw + r.commissionKrw,
      partnerCouponShareKrw: a.partnerCouponShareKrw + r.partnerCouponShareKrw,
    }),
    { ...EMPTY_TOTALS }
  );

  // 제7조 9항 — 이전 달에 정산한 건이 이번 달에 취소되면 차기 정산에서 차감한다.
  const { data: prev, error: prevError } = await supabase
    .from("applications")
    .select(SELECT)
    .not("paid_at", "is", null)
    .lt("created_at", start)
    .gte("cancelled_at", start)
    .lt("cancelled_at", end)
    .order("cancelled_at");

  if (prevError) {
    console.error("[settlement] 차감분 조회 실패", prevError);
    throw new Error(`차감 대상을 불러오지 못했습니다: ${prevError.message}`);
  }

  const deductions = ((prev ?? []) as unknown as Raw[])
    .filter(isPartner)
    .map((r) => settleOne(r, themeNames));

  return { month, rows, totals, deductions };
}

/* ────────────────────────────────────────────────────────────────
   정산 내역 보관(스냅샷)

   ⚠️ **보관은 계산에 영향을 주지 않는다.** 보관했다고 그 건이 '정산 완료'로
      분류되거나 다음 달에서 빠지거나 하지 않는다. getSettlement() 은 아래
      표를 읽지 않으며, 그 구조를 깨지 말 것.
      화면에 보낸 시점의 숫자를 그대로 남겨 두기 위한 기록일 뿐이다.
   ──────────────────────────────────────────────────────────────── */

export type SettlementSnapshot = {
  id: string;
  month: string;
  capturedAt: string;
  note: string | null;
  totals: SettlementResult["totals"];
  rows: SettlementRow[];
  deductions: SettlementRow[];
};

/** 그 달에 보관해 둔 내역들. 최신 순. */
export async function listSnapshots(month: string): Promise<SettlementSnapshot[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settlement_snapshots")
    .select("id, month, captured_at, note, totals, rows, deductions")
    .eq("month", month)
    .order("captured_at", { ascending: false });

  if (error) {
    console.error("[settlement] 보관 내역 조회 실패", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    month: r.month as string,
    capturedAt: r.captured_at as string,
    note: (r.note as string | null) ?? null,
    totals: r.totals as SettlementResult["totals"],
    rows: (r.rows ?? []) as SettlementRow[],
    deductions: (r.deductions ?? []) as SettlementRow[],
  }));
}

/**
 * 지금 화면의 내역을 그대로 보관한다.
 *
 * ⚠️ 클라이언트가 보낸 숫자를 믿지 않는다. 서버에서 다시 계산해 저장한다 —
 *    보관본은 분쟁 시 근거가 되므로 화면에서 조작할 수 있으면 안 된다.
 */
export async function saveSnapshot(month: string, note: string | null): Promise<void> {
  const result = await getSettlement(month);
  const supabase = createAdminClient();
  const { error } = await supabase.from("settlement_snapshots").insert({
    month,
    note: note?.trim() || null,
    totals: result.totals,
    rows: result.rows,
    deductions: result.deductions,
  });
  if (error) throw new Error(`보관에 실패했습니다: ${error.message}`);
}
