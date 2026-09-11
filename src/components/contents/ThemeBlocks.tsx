import Image from "next/image";
import { HudCard } from "@/components/ui/HudCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RichText } from "@/components/ui/RichText";
import type { ThemeBlock } from "@/types/catalog";

/** 시작 시각 + 경과 분 → 표시용 시각. */
function offsetToTime(startAt: string, offsetMin: number): string {
  const d = new Date(new Date(startAt).getTime() + offsetMin * 60 * 1000);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * 테마 상세 콘텐츠 렌더링.
 *
 * 운영자가 어드민에서 쌓은 순서 그대로 그린다. 블록 종류마다 모양만 다르고
 * 어떤 블록이 몇 개 오든 상관없다.
 */
export function ThemeBlocks({
  blocks,
  accent,
  sampleStartAt,
}: {
  blocks: ThemeBlock[];
  accent: string;
  /** 타임테이블의 경과 분을 실제 시각으로 바꿀 기준. 없으면 "+30분" 으로 표시. */
  sampleStartAt: string | null;
}) {
  return (
    <>
      {blocks.map((block, i) => (
        <section key={i} className="mb-14">
          {block.title && (
            <SectionHeading eyebrow="" title={block.title} align="left" eyebrowColor={accent} />
          )}

          {block.type === "text" && (
            <RichText text={block.body} className="mt-4 block leading-relaxed" />
          )}

          {block.type === "image" && block.src && (
            <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-white/12">
              <Image src={block.src} alt={block.alt || block.title} fill className="object-cover" />
            </div>
          )}

          {block.type === "list" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {block.items.map((c, x) => (
                <HudCard key={x} className="p-4">
                  {c.emoji && <p className="text-lg">{c.emoji}</p>}
                  <p className="mt-1 font-semibold">{c.title}</p>
                  {c.desc && <p className="mt-1 text-sm text-muted">{c.desc}</p>}
                </HudCard>
              ))}
            </div>
          )}

          {block.type === "timetable" && (
            <>
              {sampleStartAt && (
                <p className="mt-2 text-xs text-muted">
                  아래 시각은 선택하신 회차 시작 시간에 맞춰 자동으로 조정됩니다.
                </p>
              )}
              <ol className="mt-5 space-y-2">
                {block.items.map((t, x) => (
                  <li key={x} className="flex gap-4 border-l-2 pl-4" style={{ borderColor: accent }}>
                    <span
                      className="w-14 shrink-0 font-mono text-sm font-bold"
                      style={{ color: accent }}
                    >
                      {sampleStartAt ? offsetToTime(sampleStartAt, t.offset_min) : `+${t.offset_min}분`}
                    </span>
                    <div className="pb-3">
                      <p className="font-semibold">{t.title}</p>
                      {t.desc && <p className="mt-0.5 text-sm text-muted">{t.desc}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {block.type === "callout" && (
            <ul className="mt-5 space-y-3">
              {block.items.map((p, x) => (
                <li key={x} className="rounded-lg border border-white/12 bg-white/[0.03] p-4">
                  <p className="font-semibold">{p.title}</p>
                  {p.desc && <p className="mt-1 text-sm text-muted">{p.desc}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
