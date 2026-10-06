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
 * 기본가 칸은 그대로 두고 오른쪽에 'N% OFF' 배지와 할인가를 세운다 —
 * 어느 쪽을 내는지는 열 제목과 배지가 말해 준다.
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
  const rows = Array.from({ length: lastTierFrom }, (_, i) => i + 1).map((n) => ({
    n,
    unit: resolveUnitPrice(tiers, n),
    promoUnit: promo ? promotionUnitPrice(promo.tiers, n) : null,
    isLast: n === lastTierFrom,
  }));

  // 어느 줄에서도 할인이 없으면 칸만 비어 보인다. 그럴 땐 칸을 아예 안 그린다.
  const hasPromoColumn = Boolean(
    promo && rows.some((r) => r.unit !== null && r.promoUnit !== null && r.promoUnit < r.unit)
  );

  /*
    모바일은 **2열**(인원 | 참가비)이고 넓은 화면은 3열(인원 | 기본가 | 얼리버드)이다.
    아래 '얼리버드 칸' 주석 참고.

    ⚠️ 예전에는 모바일에서도 3열이라 여백을 8px 까지 줄여야 했고, 그래도 좁은
       기기에서 금액이 잘렸다(360px 에서 39px 초과 — 2026-10-04 제보).
       2열로 접고 나서 12px 로 되돌렸다.
  */
  /*
    ⚠️ 360px 미만(구형 아이폰 SE 등)에서는 12px 여백이 14px 모자란다.
       거기서만 8px 로 줄인다 — 그보다 넓은 기기는 12px 그대로.
  */
  const cellX = lg
    ? "px-2 min-[360px]:px-3 sm:px-7"
    : "px-2 min-[360px]:px-3 sm:px-5";
  const cellY = lg ? "py-3 sm:py-6" : "py-3 sm:py-5";
  const headY = lg ? "py-2.5 sm:py-4" : "py-2.5 sm:py-3.5";

  /*
    ⚠️ overflow-hidden 이 아니라 **overflow-x-auto** 다.
       hidden 이면 좁은 화면에서 얼리버드 금액이 **소리 없이 잘려 나간다** —
       360px 기기에서 '55,000원' 의 '원' 이 사라졌다(2026-10-04 제보).
       가로 스크롤은 보기 좋지 않지만, 가격이 사라지는 것보다는 낫다.
       열이 화면에 들어가게 만드는 것이 먼저고, 이건 마지막 안전망이다.
  */
  return (
    <div className="overflow-x-auto rounded-xl border border-white/15">
      {/* ⚠️ 모바일 글씨는 한 단계 낮다 — 세 칸을 390px 안에 넣기 위해서다. */}
      <table className={`w-full ${lg ? "text-body text-h3" : "text-body"}`}>
        <thead>
          <tr
            className="border-b border-white/12 bg-white/[0.04] text-label text-muted"
          >
            <th className={`${cellX} ${headY} text-left font-medium`}>인원</th>
            {/*
              기본가 열 제목도 **자기 열의 색**으로 맞춘다(2026-10-01 요청).
              얼리버드 제목만 색이 있으면 그쪽만 '진짜 가격' 처럼 읽힌다.
              ⚠️ 이건 **열이 나란히 놓인 데스크톱 이야기다.** 모바일은 두 금액이
                 위아래로 붙어 색이 서로 경쟁하므로 기본가에서 색을 뺐다(2026-10-05).
              ⚠️ 프로모션이 없을 때는 비교할 열이 없으므로 예전처럼 흐린 제목 그대로 둔다.

              ⚠️ 프로모션이 있을 때 **모바일에서는 이 칸을 감추고** 아래 얼리버드
                 칸이 두 금액을 함께 맡는다. 머리글도 거기서 두 줄로 나뉜다.
            */}
            <th
              className={`${cellX} ${headY} text-right ${hasPromoColumn ? "hidden font-bold sm:table-cell" : "font-medium"}`}
              style={hasPromoColumn ? { color: accent } : undefined}
            >
              {hasPromoColumn ? "기본가" : "1인당"}
            </th>
            {hasPromoColumn && (
              <th
                className={`${cellX} ${headY} text-right font-bold`}
                style={{ color: promo!.accentColor }}
              >
                {/*
                  모바일은 한 칸에 두 금액이 위아래로 들어가므로 머리글도 두 줄이다.

                  ⚠️ 모바일에서는 **기본가 쪽에 색을 주지 않는다**(2026-10-05 요청).
                     세 열로 떨어져 있을 때는 열마다 자기 색을 갖는 게 맞았지만
                     (아래 데스크톱 주석 참고), 위아래로 붙이고 나니 민트와 노랑이
                     서로 경쟁해 어느 쪽이 할인가인지 구분이 안 됐다.
                     기본가는 흐리게 두고 얼리버드만 색을 갖는다.
                */}
                <span className="flex flex-col items-end leading-tight sm:hidden">
                  <span className="text-muted">기본가</span>
                  <span>{promo!.label}</span>
                </span>
                <span className="hidden sm:inline">{promo!.label}</span>
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
            // '가장 합리적인 가격' 줄. 배지와 같은 조건으로 묶어 둘이 따로 놀지 않게 한다.
            const best = isLast && rows.length > 1;

            return (
              /*
                마지막 구간 줄 강조.
                ⚠️ 바탕을 **왼쪽만 진하게** 깔고 오른쪽으로 흘려 보낸다. 줄 전체를
                   강조색으로 채우면 오른쪽 금액 칸에서 'N% OFF'(프로모션 색) 배지와
                   색이 부딪혀 둘 다 안 읽힌다. 왼쪽은 '추천 줄' 표시, 오른쪽은
                   금액이 읽히는 자리로 역할을 갈라 둔 것이다.
              */
              <tr
                key={n}
                className="border-b border-white/8 last:border-0"
                style={
                  best
                    ? {
                        backgroundImage: `linear-gradient(90deg, ${accent}24, ${accent}0f 45%, transparent)`,
                      }
                    : undefined
                }
              >
                <td
                  className={`${cellX} ${cellY} ${best ? "font-bold" : ""}`}
                  style={best ? { boxShadow: `inset 4px 0 0 0 ${accent}` } : undefined}
                >
                  {/*
                    마지막 구간에 '가장 합리적인 가격' 을 붙인다(2026-10-01 요청).
                    ⚠️ 구간이 하나뿐이면 달지 않는다 — 비교할 줄이 없는데 '가장' 이라고
                       적으면 빈말이 된다.
                    ⚠️ 색은 **기본가 열과 같은 강조색**이다. 얼리버드(프로모션 색)와
                       겹치면 색이 뜻을 두 개 갖게 되어 둘 다 안 읽힌다.
                  */}
                  <span className="inline-flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <span>{n}인{isLast && maxGroupSize === null ? " 이상" : ""}</span>
                    {best && (
                      <span
                        // 배지는 12px(text-micro) 아래로 내리지 않는다 — 9px 이었다
                        // (2026-10-04 UX 진단: 화면에서 가장 작은 글자였다).
                        className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-micro font-extrabold leading-tight sm:px-2"
                        style={{ backgroundColor: accent, color: "#0a0a12" }}
                      >
                        가장 합리적인 가격
                      </span>
                    )}
                  </span>
                </td>

                {/*
                  기본가. 얼리버드 칸이 붙어도 **모양을 바꾸지 않는다** — 운영에 나가 있는
                  표와 같은 굵기·크기·강조색 그대로다(2026-10-01 요청).
                  취소선으로 눌러 봤지만, 정가가 흐려지면 표가 '할인 안내문'처럼 읽히고
                  기본가가 얼마인지도 잘 안 보였다.
                */}
                {/* ⚠️ 프로모션이 있으면 모바일에서는 감춘다 — 아래 칸이 두 금액을 함께 보여준다. */}
                <td
                  className={`${cellX} ${cellY} text-right font-bold ${hasPromoColumn ? "hidden sm:table-cell" : ""}`}
                  style={{ color: accent }}
                >
                  {formatKrw(unit)}
                </td>

                {hasPromoColumn && (
                  <td className={`${cellX} ${cellY} text-right`}>
                    {discounted ? (
                      /*
                        할인율 배지와 금액을 한 묶음으로. 배지를 금액 **앞**에 두는
                        이유는, 줄을 훑을 때 "몇 % 싸지나" 가 먼저 걸려야 금액이
                        크게 느껴지기 때문이다.
                        ⚠️ 좁은 화면에서도 **한 줄**로 둔다(2026-10-01 요청). 위아래로
                           접으면 그 줄만 키가 커져서, 왼쪽의 인원·기본가가 할인가와
                           다른 높이에 놓인다 — 같은 줄의 숫자인데 눈높이가 어긋난다.
                      */
                      <span className="flex flex-col items-end gap-0.5 sm:inline-flex sm:flex-row sm:items-center sm:gap-2">
                        {/*
                          모바일 전용 기본가 줄. 세 칸이 좁은 화면을 넘어가서 2열로
                          접은 결과다(2026-10-04).

                          ⚠️ **색을 주지 않는다**(2026-10-05 요청). 민트(테마색)로 뒀더니
                             바로 아래 노랑 할인가와 밝기가 비슷해 둘이 경쟁했고,
                             어느 쪽이 할인가인지 한눈에 안 들어왔다.
                          ⚠️ 그렇다고 취소선을 긋거나 더 흐리게 하지는 말 것 — 정가가
                             안 보이면 표가 '할인 안내문' 처럼 읽힌다(2026-10-01 요청).
                             색만 빼고 굵기는 남긴다.
                        */}
                        <span className="font-bold text-muted sm:hidden">
                          {formatKrw(unit)}
                        </span>
                        <span className="inline-flex items-center justify-end gap-1 sm:contents">
                        <span
                          // 위 '가장 합리적인 가격' 배지와 같은 크기로 묶는다(text-micro).
                          className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-micro font-extrabold leading-tight sm:px-2"
                          style={{ backgroundColor: promo!.accentColor, color: "#0a0a12" }}
                        >
                          {off}% OFF
                        </span>
                        <span
                          /*
                            ⚠️ 글자 크기 토큰으로 옮기지 않는다(2026-10-06).
                               가장 가까운 text-h2 는 모바일에서 22px 인데 지금은 16px 이다.
                               이 표는 좁은 화면에서 금액이 **실제로 잘렸던 곳**이라
                               (2026-10-05, 모바일 2열 접기로 고침) 키우면 그 문제가 돌아온다.
                               척도 밖에 남은 몇 안 되는 자리다.
                          */
                          className={`whitespace-nowrap font-extrabold ${
                            lg ? "text-base sm:text-2xl lg:text-[1.75rem]" : "text-sm sm:text-xl"
                          }`}
                          style={{ color: promo!.accentColor }}
                        >
                          {formatKrw(promoUnit!)}
                        </span>
                        </span>
                      </span>
                    ) : (
                      // 할인이 없는 구간. '-' 는 '모른다' 는 뜻으로만 쓰므로
                      // 여기서는 기본가와 같다는 걸 글자로 적는다.
                      <span className="text-body-sm text-muted">기본가와 동일</span>
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
    <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-body-sm text-white/75 sm:flex-row sm:items-center sm:justify-between">
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
