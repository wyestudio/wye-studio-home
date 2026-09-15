import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RichText } from "@/components/ui/RichText";
import { PlanetDot, type Planet } from "@/components/ui/PlanetDot";
import { FlatFaqAccordion } from "@/components/ui/FlatFaqAccordion";
import { PriceTable } from "@/components/contents/PriceTable";
import { ReviewLinkSlider } from "@/components/contents/ReviewLinkSlider";
import { VenueCard } from "@/components/contents/VenueCard";
import type { ThemeBlock, ThemePriceTier, PublicVenue } from "@/types/catalog";
import { SCREEN_SECTION } from "@/components/contents/screenSection";

/** 타임테이블 점의 행성 색. 항목이 4개를 넘으면 처음부터 다시 돈다. */
const PLANET_CYCLE: Planet[] = ["mercury", "venus", "earth", "mars"];

/**
 * 테마 상세 콘텐츠 렌더링.
 *
 * 운영자가 어드민에서 쌓은 순서 그대로 그린다. 블록 종류마다 모양만 다르고
 * 어떤 블록이 몇 개 오든 상관없다.
 *
 * **한 화면에 블록 하나**씩 세운다(SCREEN_SECTION). 첫 화면(테마 소개)과 같은 규칙이다.
 * 단, **라벨·제목이 둘 다 없는 블록은 바로 앞 블록과 같은 화면에 붙인다.**
 * 그런 블록은 앞 블록의 덧붙임이다 — 예: 진행 순서 아래 '*자세한 타임테이블은 현장
 * 상황에 따라…' 한 줄. 혼자 한 화면을 차지하면 무슨 말인지 모른다.
 */
export function ThemeBlocks({
  blocks,
  accent,
  tiers = [],
  maxGroupSize = null,
  venue = null,
}: {
  blocks: ThemeBlock[];
  accent: string;
  /** 가격표 블록이 쓸 요금 구간. 블록이 아니라 테마가 들고 있는 값이다. */
  tiers?: ThemePriceTier[];
  maxGroupSize?: number | null;
  /** 장소 블록이 쓸 공개용 장소 정보. 이것도 테마가 들고 있는 값이다. */
  venue?: PublicVenue | null;
}) {
  // 숨긴 블록은 고객 화면에서만 빠진다. 어드민에는 그대로 남아 있다.
  // 요금 구간이 하나도 없는 테마의 가격표 블록은 제목만 덩그러니 남으므로 뺀다. 장소도 같다.
  const visible = blocks.filter(
    (b) =>
      !b.hidden &&
      !(b.type === "price" && tiers.length === 0) &&
      !(b.type === "venue" && !venue?.area_label)
  );

  const screens: ThemeBlock[][] = [];
  for (const b of visible) {
    const headless = !b.eyebrow?.trim() && !b.title?.trim();
    if (headless && screens.length > 0) screens[screens.length - 1].push(b);
    else screens.push([b]);
  }

  return (
    <>
      {screens.map((group, i) => (
        <section key={i} data-screen className={SCREEN_SECTION}>
          {group.map((block, j) => (
            // 같은 화면 안에 붙은 덧붙임 블록은 조금만 띄운다.
            <div key={j} className={j > 0 ? "mt-6" : undefined}>
              <ThemeBlockView
                block={block}
                accent={accent}
                tiers={tiers}
                maxGroupSize={maxGroupSize}
                venue={venue}
              />
            </div>
          ))}
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
  venue = null,
}: {
  block: ThemeBlock;
  accent: string;
  tiers?: ThemePriceTier[];
  maxGroupSize?: number | null;
  venue?: PublicVenue | null;
}) {
  // 제목은 전부 가운데. 블록마다 왼쪽/가운데가 섞이면 시선이 계속 튄다.
  // included 도 라벨·제목을 달 수 있다. 다만 기본은 비워 두는 쪽이다 —
  // 아래 '참가비 포함 사항' 주석 참고.
  const heading = (block.eyebrow || block.title) && (
    <SectionHeading
      eyebrow={block.eyebrow ?? ""}
      title={block.title}
      className="mb-6 sm:mb-10"
      eyebrowColor={accent}
      size="lg"
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
        <div className="mx-auto w-full max-w-3xl">
          <PriceTable tiers={tiers} maxGroupSize={maxGroupSize} accent={accent} size="lg" />
        </div>
      )}

      {block.type === "venue" &&
        (venue?.area_label ? (
          <VenueCard venue={venue} accent={accent} />
        ) : (
          // 고객 화면에서는 위 filter 가 이미 뺀다. 여기 오는 건 어드민 미리보기뿐이다.
          <p className="text-center text-xs text-muted">연결된 장소에 공개용 위치가 없습니다.</p>
        ))}

      {/* 짧은 주석 한 줄로 쓰이는 자리라 제목들과 같이 가운데로 둔다. */}
      {block.type === "text" && (
        <RichText text={block.body} className="block text-center text-sm leading-relaxed sm:text-base" />
      )}

      {block.type === "image" && block.src && (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-white/15">
          <Image src={block.src} alt={block.alt || block.title} fill className="object-cover" />
        </div>
      )}

      {/*
        참가비 포함 사항.

        ⚠️ 라벨·제목(바깥 SectionHeading)은 **비워 두는 것이 기본이다.** 가격표에서
           눈을 떼기 전에 읽혀야 하므로 **가격표에 이어 붙은 한 판**으로 보여야 하는데,
           위에 큰 제목이 붙으면 별개의 섹션으로 끊겨 보인다. 그래서 큰 문구(headline)는
           판 안에 둔다. 필요하면 어드민에서 라벨·제목을 채울 수 있다.
      */}
      {block.type === "list" && block.variant === "included" && (
        <div
          className="w-full overflow-hidden rounded-2xl border border-panel-border bg-panel p-6 sm:p-10 lg:p-12"
        >
          {block.headline && (
            <p className="text-lg font-extrabold leading-snug text-foreground sm:text-2xl lg:text-3xl">
              {block.headline}
            </p>
          )}
          {block.subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-muted sm:mt-3 sm:text-base">{block.subtitle}</p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
            {block.items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-panel-border bg-panel-raised p-5 sm:px-7 sm:py-8"
              >
                {/* 이모지는 배경 없이 그대로 둔다 — 원형 바탕을 깔면 아이콘처럼
                    보이려다 색만 튀어서, 카드가 산만해진다. */}
                {/* 이모지마다 글자 높이가 달라 제목 줄이 어긋난다. 데스크톱에서는
                    높이를 고정해 세 카드의 제목이 한 줄에 맞게 한다. */}
                {item.emoji && (
                  <span
                    className="mb-3 flex items-center text-2xl leading-none sm:mb-5 sm:h-10 sm:text-4xl"
                    aria-hidden
                  >
                    {item.emoji}
                  </span>
                )}
                <p className="font-bold text-foreground sm:text-lg lg:text-xl">{item.title}</p>
                {item.desc && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted sm:mt-2 sm:text-sm lg:text-base">
                    {item.desc}
                  </p>
                )}
              </div>
            ))}
          </div>

          {block.highlight && (
            <p
              className="mt-5 rounded-xl border px-5 py-3.5 text-center text-sm font-semibold sm:mt-6 sm:py-4 sm:text-base lg:text-lg"
              style={{ backgroundColor: `${accent}12`, borderColor: `${accent}33`, color: accent }}
            >
              {block.highlight}
            </p>
          )}

          {block.footnote && (
            <p className="mt-4 text-[11px] leading-relaxed text-muted sm:text-xs lg:text-sm">{block.footnote}</p>
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
                className="relative rounded-xl border border-panel-border bg-panel p-5 pt-6 sm:p-7 sm:pt-8"
              >
                <span className="absolute -top-3 left-4 rounded-full bg-brand px-3 py-1 text-[11px] font-extrabold text-brand-foreground">
                  STEP {i + 1}
                </span>
                <p className="mb-2 font-bold text-foreground sm:text-lg lg:text-xl">
                  {step.emoji} {step.title}
                </p>
                <p className="text-xs leading-relaxed text-muted sm:text-sm lg:text-base">{step.desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {block.items.map((card, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-panel-border bg-panel p-5 sm:gap-5 sm:p-7 lg:p-8"
              >
                {card.emoji && (
                  <span className="text-2xl sm:text-4xl" aria-hidden>
                    {card.emoji}
                  </span>
                )}
                <div>
                  <p className="font-bold text-foreground sm:text-lg lg:text-xl">{card.title}</p>
                  {card.desc && (
                    <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-2 sm:text-sm lg:text-base">
                      {card.desc}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

      {block.type === "timetable" && (
        <div className="mx-auto flex w-full max-w-xl flex-col sm:max-w-2xl lg:max-w-3xl">
          {block.items.map((t, i) => (
            <div key={i} className="flex gap-4 pb-6 last:pb-0 sm:gap-6 sm:pb-10">
              <div className="flex flex-col items-center">
                <PlanetDot planet={PLANET_CYCLE[i % PLANET_CYCLE.length]} className="mt-1" />
                {i < block.items.length - 1 ? <div className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="pb-1">
                <p className="text-xs font-extrabold sm:text-sm" style={{ color: accent }}>
                  {i + 1}
                </p>
                <p className="mt-0.5 font-bold text-foreground sm:mt-1 sm:text-xl lg:text-2xl">{t.title}</p>
                {t.desc && (
                  <p className="mt-1 text-xs text-muted sm:mt-2 sm:text-base lg:text-lg">{t.desc}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.type === "callout" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {block.items.map((p, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl border border-panel-border bg-panel p-5 sm:gap-5 sm:p-6 lg:p-7"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/20 text-xs font-bold text-danger sm:h-9 sm:w-9 sm:text-sm">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <p className="font-bold text-foreground sm:text-lg">{p.title}</p>
                {p.desc && (
                  <p className="text-xs leading-relaxed text-muted sm:text-sm lg:text-base">{p.desc}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {block.type === "faq" && (
        <div className="mx-auto w-full max-w-4xl">
          <FlatFaqAccordion items={block.items} size="lg" />
        </div>
      )}

      {block.type === "reviews" && (
        <ReviewsBlock block={block} accent={accent} />
      )}
    </>
  );
}

/** 후기 블록 전체. 수치 → 한 줄 후기 → 인스타 순으로 좁혀 읽힌다. */
function ReviewsBlock({
  block,
  accent,
}: {
  block: Extract<ThemeBlock, { type: "reviews" }>;
  accent: string;
}) {
  const links = block.links.filter((l) => l.url);

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {/* 제목 아래 한 줄. 제목들과 같이 가운데. */}
      {block.subtitle && (
        <p className="-mt-2 text-center text-sm leading-relaxed text-muted sm:-mt-4 sm:text-base lg:text-lg">
          {block.subtitle}
        </p>
      )}

      {/*
        요약 수치.
        ⚠️ 큰 숫자만 덩그러니 두지 않는다. 어디서 나온 숫자인지(note)를 같이
           보여줘야 "우리가 지어낸 값" 으로 읽히지 않는다.
      */}
      {block.stats.length > 0 && (
        <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:max-w-3xl">
          {block.stats.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-panel-border bg-panel px-5 py-6 text-center sm:px-6 sm:py-7"
            >
              <p
                className="text-[2rem] font-extrabold leading-none tabular-nums sm:text-[2.4rem] lg:text-5xl"
                style={{ color: accent }}
              >
                {s.value}
              </p>
              <p className="mt-2.5 text-sm font-bold text-foreground sm:mt-3 sm:text-base">{s.label}</p>
              {s.note && <p className="mt-1 text-[11px] leading-relaxed text-muted">{s.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 한 줄 후기. 인용부호는 CSS 로 깔아 글자 수를 늘리지 않는다. */}
      {block.quotes.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {block.quotes.map((q, i) => (
            <figure
              key={i}
              className="relative rounded-xl border border-panel-border bg-panel p-5 sm:p-6"
            >
              <span
                aria-hidden
                className="absolute left-4 top-2 select-none text-3xl leading-none opacity-25 sm:left-5"
                style={{ color: accent }}
              >
                &ldquo;
              </span>
              <blockquote className="relative pt-3 text-sm leading-relaxed text-foreground sm:text-base">
                {q.text}
              </blockquote>
              {q.meta && (
                <figcaption className="mt-3 text-[11px] text-muted sm:text-xs">{q.meta}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {/*
        크리에이터 후기. 채널이 섞여 있어 슬라이더 안에서 폭을 맞춘다.
        인스타는 공식 임베드라 클라이언트에서만 뜨므로 별도 컴포넌트로 뺐다.
      */}
      {links.length > 0 && <ReviewLinkSlider links={links} accent={accent} />}
    </div>
  );
}
