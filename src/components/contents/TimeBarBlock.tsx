import type { ThemeBlock } from "@/types/catalog";

type TimeBarData = Extract<ThemeBlock, { type: "timebar" }>;

/**
 * 진행 시간 막대 — 한 회차가 어떻게 흘러가는지 시간 비율대로 보여준다.
 * 노말모드의 '방탈출 90분 + 코인마켓 10분' 처럼(2026-10-18).
 *
 * ⚠️ 칸 폭은 분(minutes) 비율이다. 다만 짧은 구간(10분)은 비율대로면 글자가 안
 *    들어가서 **최소 폭**을 둔다 — 정확한 비율보다 '무엇이 있는지' 가 먼저다.
 * ⚠️ 설명(desc)은 막대 안에 넣지 않고 아래 목록으로 뺀다. 좁은 칸에 설명을 밀어
 *    넣으면 모바일에서 세로로 한 글자씩 꺾인다.
 * ⚠️ 첫 구간만 강조색이다. 본 게임이 무엇인지가 먼저 보여야 한다.
 */
export function TimeBarBlock({ block, accent }: { block: TimeBarData; accent: string }) {
  const items = block.items.filter((it) => it.title.trim() && it.minutes > 0);
  if (items.length === 0 && !block.note) return null;
  const total = items.reduce((s, it) => s + it.minutes, 0);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {items.length > 0 && (
        <>
          <div className="flex gap-2" role="img" aria-label={`총 ${total}분 — ${items.map((it) => `${it.title} ${it.minutes}분`).join(", ")}`}>
            {items.map((it, i) => (
              <div
                key={i}
                className="flex min-w-24 flex-col justify-between rounded-lg border border-line bg-fill-subtle px-4 py-4 sm:px-5 sm:py-5"
                style={{
                  flexGrow: it.minutes,
                  flexBasis: 0,
                  ...(i === 0
                    ? { borderColor: `${accent}73`, backgroundColor: `${accent}14` }
                    : undefined),
                }}
              >
                <p className={`text-body font-semibold ${i === 0 ? "" : "text-muted"}`}>{it.title}</p>
                <p
                  className="mt-6 font-mono text-h2 font-extrabold leading-none tabular-nums sm:mt-10"
                  style={i === 0 ? { color: accent } : undefined}
                >
                  {it.minutes}
                  <span className="ml-0.5 text-label font-normal text-muted">분</span>
                </p>
              </div>
            ))}
          </div>

          <ul className="mt-4 flex flex-col gap-2">
            {items
              .filter((it) => it.desc.trim())
              .map((it, i) => (
                <li key={i} className="flex gap-3 text-body">
                  <span className="shrink-0 font-semibold" style={i === 0 ? { color: accent } : undefined}>
                    {it.title}
                  </span>
                  <span className="text-muted">{it.desc}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      {block.note && (
        <p className="mt-4 rounded-lg border border-line bg-fill px-4 py-3 text-body">{block.note}</p>
      )}
    </div>
  );
}
