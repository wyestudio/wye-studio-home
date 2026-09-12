import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RichText } from "@/components/ui/RichText";
import { PlanetDot, type Planet } from "@/components/ui/PlanetDot";
import { FlatFaqAccordion } from "@/components/ui/FlatFaqAccordion";
import type { ThemeBlock } from "@/types/catalog";

/** 타임테이블 점의 행성 색. 항목이 4개를 넘으면 처음부터 다시 돈다. */
const PLANET_CYCLE: Planet[] = ["mercury", "venus", "earth", "mars"];

/**
 * 테마 상세 콘텐츠 렌더링.
 *
 * 운영자가 어드민에서 쌓은 순서 그대로 그린다. 블록 종류마다 모양만 다르고
 * 어떤 블록이 몇 개 오든 상관없다.
 */
export function ThemeBlocks({ blocks, accent }: { blocks: ThemeBlock[]; accent: string }) {
  return (
    <>
      {/* 블록 사이는 넉넉히 띄운다 — 붙어 있으면 어디서 끊기는지 안 보인다. */}
      {blocks.map((block, i) => (
        <section key={i} className="mb-20 last:mb-0 sm:mb-24">
          <ThemeBlockView block={block} accent={accent} />
        </section>
      ))}
    </>
  );
}

/**
 * 블록 하나. 어드민 편집 화면의 미리보기도 이걸 그대로 쓴다 —
 * 미리보기와 실제 화면이 다른 코드로 그려지면 반드시 어긋난다.
 *
 * 모양은 8/29 회차 페이지(`/sessions/[slug]`)의 것을 그대로 옮겼다.
 */
export function ThemeBlockView({ block, accent }: { block: ThemeBlock; accent: string }) {
  // 타임테이블은 가운데 정렬. 본문이 가운데 좁게 서 있는데 제목만 왼쪽에
  // 붙어 있으면 따로 논다.
  const centered = block.type === "timetable";

  const heading = (block.eyebrow || block.title) && (
    <SectionHeading
      eyebrow={block.eyebrow ?? ""}
      title={block.title}
      align={centered ? "center" : "left"}
      className="mb-6"
      eyebrowColor={accent}
    />
  );

  return (
    <>
      {heading}

      {block.type === "text" && <RichText text={block.body} className="block leading-relaxed" />}

      {block.type === "image" && block.src && (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border">
          <Image src={block.src} alt={block.alt || block.title} fill className="object-cover" />
        </div>
      )}

      {block.type === "list" &&
        (block.variant === "step" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {block.items.map((step, i) => (
              <div
                key={i}
                className="relative rounded-xl border border-border bg-surface p-5 pt-6"
              >
                <span className="absolute -top-3 left-4 rounded-full bg-brand px-3 py-1 text-[11px] font-extrabold text-brand-foreground">
                  STEP {i + 1}
                </span>
                <p className="mb-2 font-bold text-foreground">
                  {step.emoji} {step.title}
                </p>
                <p className="text-xs leading-relaxed text-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {block.items.map((card, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-5">
                {card.emoji && (
                  <span className="text-2xl" aria-hidden>
                    {card.emoji}
                  </span>
                )}
                <div>
                  <p className="font-bold text-foreground">{card.title}</p>
                  {card.desc && <p className="mt-1 text-xs text-muted">{card.desc}</p>}
                </div>
              </div>
            ))}
          </div>
        ))}

      {block.type === "timetable" && (
        <div className="mx-auto flex max-w-xl flex-col">
          {block.items.map((t, i) => (
            <div key={i} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <PlanetDot planet={PLANET_CYCLE[i % PLANET_CYCLE.length]} className="mt-1" />
                {i < block.items.length - 1 ? <div className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="pb-1">
                <p className="text-xs font-extrabold" style={{ color: accent }}>
                  {i + 1}
                </p>
                <p className="mt-0.5 font-bold text-foreground">{t.title}</p>
                {t.desc && <p className="mt-1 text-xs text-muted">{t.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.type === "callout" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {block.items.map((p, i) => (
            <div key={i} className="flex gap-4 rounded-xl border border-border bg-surface p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/20 text-xs font-bold text-danger">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-bold text-foreground">{p.title}</p>
                {p.desc && <p className="text-xs text-muted">{p.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.type === "faq" && <FlatFaqAccordion items={block.items} />}
    </>
  );
}
