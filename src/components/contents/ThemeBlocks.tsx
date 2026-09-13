import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RichText } from "@/components/ui/RichText";
import { PlanetDot, type Planet } from "@/components/ui/PlanetDot";
import { FlatFaqAccordion } from "@/components/ui/FlatFaqAccordion";
import { PriceTable } from "@/components/contents/PriceTable";
import type { ThemeBlock, ThemePriceTier } from "@/types/catalog";

/** 타임테이블 점의 행성 색. 항목이 4개를 넘으면 처음부터 다시 돈다. */
const PLANET_CYCLE: Planet[] = ["mercury", "venus", "earth", "mars"];

/**
 * 테마 상세 콘텐츠 렌더링.
 *
 * 운영자가 어드민에서 쌓은 순서 그대로 그린다. 블록 종류마다 모양만 다르고
 * 어떤 블록이 몇 개 오든 상관없다.
 */
export function ThemeBlocks({
  blocks,
  accent,
  tiers = [],
  maxGroupSize = null,
}: {
  blocks: ThemeBlock[];
  accent: string;
  /** 가격표 블록이 쓸 요금 구간. 블록이 아니라 테마가 들고 있는 값이다. */
  tiers?: ThemePriceTier[];
  maxGroupSize?: number | null;
}) {
  return (
    <>
      {/* 블록 사이는 넉넉히 띄운다 — 붙어 있으면 어디서 끊기는지 안 보인다. */}
      {/* 숨긴 블록은 고객 화면에서만 빠진다. 어드민에는 그대로 남아 있다. */}
      {/* 요금 구간이 하나도 없는 테마의 가격표 블록은 제목만 덩그러니 남으므로 뺀다. */}
      {blocks
        .filter((b) => !b.hidden && !(b.type === "price" && tiers.length === 0))
        .map((block, i) => (
          <section key={i} className="mb-24 last:mb-0 sm:mb-32">
            <ThemeBlockView
              block={block}
              accent={accent}
              tiers={tiers}
              maxGroupSize={maxGroupSize}
            />
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
export function ThemeBlockView({
  block,
  accent,
  tiers = [],
  maxGroupSize = null,
}: {
  block: ThemeBlock;
  accent: string;
  tiers?: ThemePriceTier[];
  maxGroupSize?: number | null;
}) {
  // 제목은 전부 가운데. 블록마다 왼쪽/가운데가 섞이면 시선이 계속 튄다.
  // included 는 제목이 판 안에 들어가므로 바깥 제목을 그리지 않는다.
  const isIncluded = block.type === "list" && block.variant === "included";
  const heading = !isIncluded && (block.eyebrow || block.title) && (
    <SectionHeading
      eyebrow={block.eyebrow ?? ""}
      title={block.title}
      className="mb-6"
      eyebrowColor={accent}
    />
  );

  return (
    <>
      {heading}

      {/*
        가격표. 폭은 아래 블록들과 맞춘다 — 좁게 잡았더니 혼자만 쪼그라들어
        보였다. 숫자는 테마의 '요금 구간' 에서 오고 블록은 자리만 잡는다.
      */}
      {block.type === "price" && (
        <div className="w-full">
          <PriceTable tiers={tiers} maxGroupSize={maxGroupSize} accent={accent} />
        </div>
      )}

      {/* 짧은 주석 한 줄로 쓰이는 자리라 제목들과 같이 가운데로 둔다. */}
      {block.type === "text" && (
        <RichText text={block.body} className="block text-center leading-relaxed" />
      )}

      {block.type === "image" && block.src && (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-white/15">
          <Image src={block.src} alt={block.alt || block.title} fill className="object-cover" />
        </div>
      )}

      {/*
        참가비 포함 사항.

        ⚠️ 별도 섹션(INCLUDED 라벨 + 큰 제목)으로 빼지 않는다. 가격표에서
           눈을 떼기 전에 읽혀야 하므로, **가격표에 이어 붙은 한 판**으로 둔다.
           그래서 제목도 이 판 안에 들어간다 — 바깥 SectionHeading 은 쓰지 않는다.
      */}
      {block.type === "list" && block.variant === "included" && (
        <div
          className="w-full overflow-hidden rounded-xl border border-panel-border bg-panel p-6 sm:p-8"
        >
          {block.title && (
            <p className="text-lg font-extrabold leading-snug text-foreground sm:text-xl">
              {block.title}
            </p>
          )}
          {block.subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{block.subtitle}</p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {block.items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-panel-border bg-panel-raised p-5 sm:px-6 sm:py-7"
              >
                {/* 이모지는 배경 없이 그대로 둔다 — 원형 바탕을 깔면 아이콘처럼
                    보이려다 색만 튀어서, 카드가 산만해진다. */}
                {/* 이모지마다 글자 높이가 달라 제목 줄이 어긋난다. 데스크톱에서는
                    높이를 고정해 세 카드의 제목이 한 줄에 맞게 한다. */}
                {item.emoji && (
                  <span
                    className="mb-3 flex items-center text-2xl leading-none sm:mb-4 sm:h-8"
                    aria-hidden
                  >
                    {item.emoji}
                  </span>
                )}
                <p className="font-bold text-foreground">{item.title}</p>
                {item.desc && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.desc}</p>
                )}
              </div>
            ))}
          </div>

          {block.highlight && (
            <p
              className="mt-5 rounded-xl border px-5 py-3.5 text-center text-sm font-semibold"
              style={{ backgroundColor: `${accent}12`, borderColor: `${accent}33`, color: accent }}
            >
              {block.highlight}
            </p>
          )}

          {block.footnote && (
            <p className="mt-4 text-[11px] leading-relaxed text-muted">{block.footnote}</p>
          )}
        </div>
      )}

      {block.type === "list" &&
        block.variant !== "included" &&
        (block.variant === "step" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {block.items.map((step, i) => (
              <div
                key={i}
                className="relative rounded-xl border border-panel-border bg-panel p-5 pt-6"
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
              <div key={i} className="flex gap-3 rounded-xl border border-panel-border bg-panel p-5">
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
            <div key={i} className="flex gap-4 rounded-xl border border-panel-border bg-panel p-5">
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
