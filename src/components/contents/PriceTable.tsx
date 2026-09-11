import { formatKrw } from "@/lib/format";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";

/**
 * 인원별 참가비 표.
 *
 * "1인 50,000원~68,000원 (인원수에 따라 다름)" 은 왜 다른지가 안 보인다.
 * 고객이 알고 싶은 건 단가가 아니라 "우리 3명인데 얼마 내지?" 이므로
 * 총액을 같이 보여준다.
 */
export function PriceTable({
  tiers,
  maxGroupSize,
  accent,
}: {
  tiers: ThemePriceTier[];
  maxGroupSize: number | null;
  accent: string;
}) {
  if (tiers.length === 0) return null;

  // 마지막 구간부터는 단가가 같으므로 "N인 이상" 한 줄로 묶는다.
  const lastTierFrom = Math.max(...tiers.map((t) => t.min_headcount));
  const rows = Array.from({ length: lastTierFrom }, (_, i) => i + 1).map((n) => ({
    n,
    unit: resolveUnitPrice(tiers, n),
    isLast: n === lastTierFrom,
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-white/15">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/12 bg-white/[0.04] text-left text-xs text-muted">
            <th className="px-4 py-2.5 font-medium">인원</th>
            <th className="px-4 py-2.5 text-right font-medium">1인당</th>
            <th className="px-4 py-2.5 text-right font-medium">총액</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, unit, isLast }) => {
            if (unit === null) return null;
            return (
              <tr key={n} className="border-b border-white/8 last:border-0">
                <td className="px-4 py-3">
                  {n}인{isLast && maxGroupSize === null ? " 이상" : ""}
                </td>
                <td className="px-4 py-3 text-right text-muted">{formatKrw(unit)}</td>
                <td className="px-4 py-3 text-right font-bold" style={{ color: accent }}>
                  {formatKrw(unit * n)}
                  {isLast && maxGroupSize === null && (
                    <span className="ml-0.5 font-normal text-muted">~</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t border-white/12 bg-white/[0.02] px-4 py-2.5 text-xs text-muted">
        인원이 많을수록 1인당 참가비가 낮아집니다.
        {maxGroupSize === null && ` ${lastTierFrom}인 이상은 같은 단가가 적용돼요.`}
      </p>
    </div>
  );
}
