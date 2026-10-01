import { formatKrw } from "@/lib/format";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";
import { discountPercent, promotionUnitPrice, type PromotionPriceTier } from "@/lib/promotion";

/**
 * 인원별 참가비 표.
 *
 * 기본은 인원과 1인당 금액 두 칸이다. 총액 칸과 하단 안내 문구는 뺐다 —
 * 표가 넓어지기만 하고, "인원이 많을수록 싸진다" 는 표를 보면 바로 읽힌다.
 *
 * 프로모션이 켜져 있으면 **얼리버드 칸이 하나 더 붙는다**(2026-10-01).
 * 그때는 기본가를 작게·취소선으로 눌러 두고 얼리버드가를 크게 세운다 —
 * 두 숫자가 같은 크기면 어느 쪽을 내는 건지 읽는 사람이 판단해야 한다.
 */
export type PriceTablePromo = {
  /** 열 제목. 보통 '얼리버드'. */
  label: string;
  accentColor: string;
  tiers: PromotionPriceTier[];
};

export function PriceTable({
  tiers,
  maxGroupSize,
  accent,
  size = "md",
  promo = null,
}: {
  tiers: ThemePriceTier[];
  maxGroupSize: number | null;
  accent: string;
  /** lg: 테마 상세(한 화면에 블록 하나)용. 글자·줄 높이를 키운다. */
  size?: "md" | "lg";
  /** 켜져 있는 프로모션. 없으면 예전 2칸 표 그대로다. */
  promo?: PriceTablePromo | null;
}) {
  const lg = size === "lg";
  if (tiers.length === 0) return null;

  // 마지막 구간부터는 단가가 같으므로 "N인 이상" 한 줄로 묶는다.
  const lastTierFrom = Math.max(...tiers.map((t) => t.min_headcount));
  /*
    인원이 **많은 쪽부터** 보여준다(2026-10-01 요청). 싼 금액이 맨 위에 오므로
    "여럿이 오면 이만큼" 이 먼저 읽히고, 아래로 갈수록 비싸진다.
    ⚠️ 'N인 이상' 판정(isLast)은 순서와 무관하게 lastTierFrom 으로 한다 —
       배열을 뒤집는다고 그 줄이 바뀌면 안 된다.
  */
  const rows = Array.from({ length: lastTierFrom }, (_, i) => lastTierFrom - i).map((n) => ({
    n,
    unit: resolveUnitPrice(tiers, n),
    promoUnit: promo ? promotionUnitPrice(promo.tiers, n) : null,
    isLast: n === lastTierFrom,
  }));

  // 어느 줄에서도 할인이 없으면 칸만 비어 보인다. 그럴 땐 칸을 아예 안 그린다.
  const hasPromoColumn = Boolean(
    promo && rows.some((r) => r.unit !== null && r.promoUnit !== null && r.promoUnit < r.unit)
  );

  const cellX = lg ? "px-4 sm:px-7" : "px-4 sm:px-5";
  const cellY = lg ? "py-3 sm:py-6" : "py-3 sm:py-5";
  const headY = lg ? "py-2.5 sm:py-4" : "py-2.5 sm:py-3.5";

  return (
    <div className="overflow-hidden rounded-xl border border-white/15">
      <table className={`w-full ${lg ? "text-base sm:text-lg lg:text-xl" : "text-sm sm:text-base"}`}>
        <thead>
          <tr
            className={`border-b border-white/12 bg-white/[0.04] text-muted ${lg ? "text-xs sm:text-sm" : "text-xs"}`}
          >
            <th className={`${cellX} ${headY} text-left font-medium`}>인원</th>
            <th className={`${cellX} ${headY} text-right font-medium`}>
              {hasPromoColumn ? "기본가" : "1인당"}
            </th>
            {hasPromoColumn && (
              <th
                className={`${cellX} ${headY} text-right font-bold`}
                style={{ color: promo!.accentColor }}
              >
                {promo!.label}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, unit, promoUnit, isLast }) => {
            if (unit === null) return null;
            const off =
              hasPromoColumn && promoUnit !== null ? discountPercent(unit, promoUnit) : 0;
            const discounted = off > 0 && promoUnit !== null;

            return (
              <tr key={n} className="border-b border-white/8 last:border-0">
                <td className={`${cellX} ${cellY}`}>
                  {n}인{isLast && maxGroupSize === null ? " 이상" : ""}
                </td>

                {/*
                  기본가. 할인이 붙은 줄에서는 **작게·취소선·흐리게** 눌러 둔다.
                  같은 크기로 두면 두 숫자 중 어느 쪽을 내는지 눈으로 판단해야 한다.
                */}
                <td
                  className={`${cellX} ${cellY} text-right ${
                    discounted
                      ? `font-medium text-muted line-through ${lg ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`
                      : "font-bold"
                  }`}
                  style={discounted ? undefined : { color: accent }}
                >
                  {formatKrw(unit)}
                </td>

                {hasPromoColumn && (
                  <td className={`${cellX} ${cellY} text-right`}>
                    {discounted ? (
                      /*
                        할인율 배지와 금액을 한 묶음으로. 배지를 금액 **앞**에 두는
                        이유는, 줄을 훑을 때 "몇 % 싸지나" 가 먼저 걸려야 금액이
                        크게 느껴지기 때문이다. 좁은 화면에서는 위아래로 접힌다.
                      */
                      <span className="inline-flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 font-extrabold leading-tight ${
                            lg ? "text-[11px] sm:text-xs" : "text-[10px] sm:text-[11px]"
                          }`}
                          style={{ backgroundColor: promo!.accentColor, color: "#0a0a12" }}
                        >
                          {off}% OFF
                        </span>
                        <span
                          className={`whitespace-nowrap font-extrabold ${
                            lg ? "text-lg sm:text-2xl lg:text-[1.75rem]" : "text-base sm:text-xl"
                          }`}
                          style={{ color: promo!.accentColor }}
                        >
                          {formatKrw(promoUnit!)}
                        </span>
                      </span>
                    ) : (
                      // 할인이 없는 구간. '-' 는 '모른다' 는 뜻으로만 쓰므로
                      // 여기서는 기본가와 같다는 걸 글자로 적는다.
                      <span className="text-xs text-muted sm:text-sm">기본가와 동일</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 가격표 아래 한 줄 안내.
 *
 * ⚠️ 표 안이 아니라 **표 바깥 아래**에 둔다. 표 안에 넣으면 금액 줄과 같은
 *    무게로 읽혀서, 안내가 가격의 일부처럼 보인다.
 */
export function PriceTableEarlyBirdNote({
  badgeLabel,
  note,
  accent,
}: {
  badgeLabel: string;
  /** '쿠폰 중복 적용 가능' 처럼 오른쪽 끝에 붙는 단서. 없으면 왼쪽 문구만. */
  note: string | null;
  accent: string;
}) {
  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/75 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
      <p>
        <span aria-hidden="true">🚀</span> 회차가{" "}
        <strong className="font-bold" style={{ color: accent }}>
          {badgeLabel} 표시
        </strong>
        되어 있으면 해당 금액이 적용됩니다.
      </p>
      {note && <p className="text-muted sm:text-right">{note}</p>}
    </div>
  );
}
