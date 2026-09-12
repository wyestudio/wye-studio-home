import { formatKrw } from "@/lib/format";
import { resolveUnitPrice, type ThemePriceTier } from "@/types/catalog";

/**
 * 인원별 참가비 표.
 *
 * 인원과 1인당 금액 두 칸만 둔다. 총액 칸과 하단 안내 문구는 뺐다 —
 * 표가 넓어지기만 하고, "인원이 많을수록 싸진다" 는 표를 보면 바로 읽힌다.
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
          <tr className="border-b border-white/12 bg-white/[0.04] text-xs text-muted">
            <th className="px-4 py-2.5 text-left font-medium">인원</th>
            <th className="px-4 py-2.5 text-right font-medium">1인당</th>
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
                <td className="px-4 py-3 text-right font-bold" style={{ color: accent }}>
                  {formatKrw(unit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
