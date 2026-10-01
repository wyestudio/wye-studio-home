/**
 * 프로모션(얼리버드) 계산 — 화면 표시 **전용**.
 *
 * ⚠️ 실제 청구액은 여기서 정하지 않는다. DB 의 resolve_promotion_price() 가
 *    신청 순간에 다시 계산하고, submit_application_v3() 가 그 값으로 금액을
 *    박는다. 이 파일은 "얼마가 될지 미리 보여주기" 위한 것이다.
 *    두 곳의 규칙이 어긋나면 화면에서 본 금액과 입금 요청 금액이 달라지므로,
 *    조건을 고칠 때는 **반드시 양쪽을 같이** 고친다
 *    (supabase/migrations/..._promotions_and_popups.sql).
 *
 * ⚠️ 적용 여부(isEarlyBirdSession)는 가능하면 **서버에서** 판정해 화면에
 *    내려준다. 브라우저 시계가 틀어진 기기에서 "화면엔 얼리버드, 제출하면
 *    기본가" 가 되는 걸 막기 위해서다. 클라이언트가 직접 부르는 자리는
 *    인원수에 따라 가격만 고르는 곳(ApplyForm)으로 제한한다.
 */

export type PublicPromotion = {
  id: string;
  name: string;
  kind: "early_bird";
  badge_label: string;
  banner_title: string | null;
  banner_body: string | null;
  banner_highlight: string | null;
  banner_note: string | null;
  accent_color: string;
  days_before: number;
  session_from: string | null;
  session_to: string | null;
  applies_from: string | null;
  applies_until: string | null;
};

export type PromotionPriceTier = {
  promotion_id: string;
  theme_id: string;
  min_headcount: number;
  unit_price_krw: number;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → KST 기준 'YYYY-MM-DD'. BookingCalendar 의 같은 이름 함수와 같은 규칙이다. */
export function kstYmd(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' 두 개의 날짜 차이(일). b - a */
function ymdDiffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * 이 회차가 지금 얼리버드 대상인가.
 *
 * ⚠️ 시각이 아니라 **KST 날짜** 차이로 센다. 시각으로 끊으면 폼을 채우는
 *    도중에 경계를 넘어 가격이 바뀐다 — 화면에서 본 금액과 입금 요청 금액이
 *    달라진다. 날짜로 끊으면 경계는 자정에 한 번만 움직인다.
 *    DB 의 active_promotion() 도 같은 규칙이다.
 */
export function isEarlyBirdSession(
  promo: PublicPromotion | null,
  startAtIso: string,
  now: Date = new Date()
): boolean {
  if (!promo) return false;

  const nowMs = now.getTime();
  if (promo.applies_from && nowMs < Date.parse(promo.applies_from)) return false;
  if (promo.applies_until && nowMs > Date.parse(promo.applies_until)) return false;

  const sessionYmd = kstYmd(new Date(startAtIso));
  if (promo.session_from && sessionYmd < promo.session_from) return false;
  if (promo.session_to && sessionYmd > promo.session_to) return false;

  return ymdDiffDays(kstYmd(now), sessionYmd) >= promo.days_before;
}

/**
 * 프로모션 적용 시의 인당 가격. 없으면 null(= 이 테마는 프로모션 대상 아님).
 * theme_price_tiers 의 resolveUnitPrice 와 같은 규칙 — 조건을 만족하는 구간 중
 * 가장 큰 것이 이긴다.
 */
export function promotionUnitPrice(
  tiers: PromotionPriceTier[],
  headcount: number
): number | null {
  const matched = tiers
    .filter((t) => t.min_headcount <= headcount)
    .sort((a, b) => b.min_headcount - a.min_headcount)[0];
  return matched ? matched.unit_price_krw : null;
}

/**
 * 할인율(%). **내림**한다 — 19.35% 를 20% 로 올려 적으면 실제보다 크게
 * 광고하는 것이 된다.
 */
export function discountPercent(basePrice: number, promoPrice: number): number {
  if (basePrice <= 0 || promoPrice >= basePrice) return 0;
  return Math.floor(((basePrice - promoPrice) / basePrice) * 100);
}

/**
 * 배너에 쓸 "최대 N% OFF". 운영자가 banner_highlight 를 직접 적었으면 그 문구가
 * 이긴다. 비워 두면 실제 가격에서 계산하므로, 금액만 고쳐도 문구가 따라온다.
 */
export function maxDiscountLabel(
  promo: PublicPromotion,
  pairs: { base: number; promo: number }[]
): string | null {
  if (promo.banner_highlight?.trim()) return promo.banner_highlight.trim();
  const max = Math.max(0, ...pairs.map((p) => discountPercent(p.base, p.promo)));
  return max > 0 ? `최대 ${max}% OFF` : null;
}
