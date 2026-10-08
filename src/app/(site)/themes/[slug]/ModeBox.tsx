import Link from "next/link";
import type { ThemeDetail } from "@/lib/themes";
import { hoursLabel } from "@/components/contents/ThemeSpecs";

/**
 * 주소에 쓸 모드 키. `/themes/baotalchul?mode=normal` 처럼 짧게 둔다.
 *
 * 변형 테마의 slug 는 **기본 테마 slug 로 시작한다**는 약속을 쓴다
 * (baotalchul → baotalchul-normal). 약속을 안 지킨 slug 면 slug 를 통째로 쓴다 —
 * 틀려도 주소만 길어질 뿐, 모드를 못 찾는 일은 없다(page.tsx 가 키·slug·id 를 다 받는다).
 */
export function modeKey(baseSlug: string, slug: string) {
  return slug.startsWith(`${baseSlug}-`) ? slug.slice(baseSlug.length + 1) : slug;
}

export function modeHref(baseSlug: string, variants: ThemeDetail[], v: ThemeDetail) {
  // 기본 모드는 ?mode 를 안 붙인다 — 같은 화면이 주소 두 개로 갈리면 검색엔진에 중복으로 잡힌다.
  return v.id === variants[0]?.id
    ? `/themes/${baseSlug}`
    : `/themes/${baseSlug}?mode=${modeKey(baseSlug, v.slug)}`;
}

/**
 * 모드 선택 창 — 게임에서 난이도·모드를 고르는 창을 본떴다.
 *
 * 왜 이 모양인가 (2026-10-08 시안)
 *   테마가 도트 게임 컨셉이라, 모드 선택도 게임 UI 로 보이면 **고르는 행위 자체가
 *   재미**가 된다. 동시에 "모드를 고른다" 는 걸 설명 없이 알게 된다.
 *
 *   ⚠️ 모양만 게임이고 **색·글꼴·간격은 사이트 토큰을 그대로 쓴다.** 시안의
 *      분홍·금색을 그대로 가져오면 화면이 두 벌로 갈린다. 테두리와 그림자처럼
 *      '도트 게임스러움' 을 만드는 요소만 빌려 온다.
 *
 * ⚠️ 강조색은 **고른 모드의 accent 를 그대로** 쓴다. 파티 민트 / 노말 분홍처럼
 *    모드마다 다른 색을 줘서, 색만 보고도 지금 어느 모드인지 알게 한다.
 */
export function ModeBox({
  variants,
  active,
  baseSlug,
  accent,
  className = "",
}: {
  variants: ThemeDetail[];
  active: ThemeDetail;
  baseSlug: string;
  /** 고른 모드의 강조색. */
  accent: string;
  /** 격자 안에서의 자리. 자리는 **부르는 쪽이** 정한다(감싸는 div 를 두면 격자 칸이 그 div 가 된다). */
  className?: string;
}) {
  if (variants.length < 2) return null;

  /*
    ⚠️ `?? []` 를 지우지 말 것. 칸을 새로 만든 직후에는 **캐시에 남아 있던 옛
       응답**에 그 칸이 없다(unstable_cache 는 빌드 사이에도 디스크에 남는다).
       실제로 여기서 화면이 500 으로 떨어졌다(2026-10-08).
  */
  const highlights = active.mode_highlights ?? [];

  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-fill-subtle ${className}`}
      style={{ boxShadow: `3px 3px 0 ${accent}2e` }}
    >
      {/* 창 머리 — 게임 창의 타이틀바 */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
        <span className="font-mono text-micro tracking-[0.18em] text-muted">SELECT MODE</span>
        <span aria-hidden className="font-mono text-micro tracking-[0.3em]" style={{ color: accent }}>
          ◆ ◆
        </span>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-h3 font-extrabold">오늘의 플레이는?</p>
        <p className="mt-1 text-body-sm text-muted">모드를 눌러 비교해보세요.</p>

        <div role="group" aria-label="모드 선택" className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
          {variants.map((v) => {
            const on = v.id === active.id;
            const c = v.accent_color || accent;
            return (
              <Link
                key={v.id}
                href={modeHref(baseSlug, variants, v)}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={`group/mode rounded-lg border px-3 py-3 transition-[transform,border-color,background-color] duration-150 sm:px-4 ${
                  on
                    ? "bg-fill-strong"
                    : "border-line bg-fill-subtle hover:-translate-y-0.5 hover:border-line-strong"
                }`}
                style={
                  on
                    ? { borderColor: c, boxShadow: `0 3px 0 ${c}` }
                    : undefined
                }
              >
                <span
                  className="block font-mono text-h3 font-extrabold"
                  style={{ color: on ? c : undefined }}
                >
                  <span aria-hidden className="mr-1">{on ? "▶" : "▷"}</span>
                  {v.variant_label ?? v.name}
                </span>
                <span className="mt-1 block text-micro text-muted">{modeTagline(v)}</span>
                <span className="mt-2.5 block font-mono text-h2 font-extrabold leading-none tabular-nums">
                  {v.duration_minutes}
                  <span className="ml-0.5 text-micro font-normal text-muted">분</span>
                </span>
              </Link>
            );
          })}
        </div>

        {active.mode_summary && (
          <p className="mt-5 text-h3 font-extrabold" style={{ color: accent }}>
            {active.mode_summary}
          </p>
        )}

        {highlights.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {highlights.map((h, i) => (
              <li
                key={`${h.label}-${i}`}
                className="relative grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-lg border border-line bg-fill-subtle px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="absolute right-0 top-0 h-1.5 w-1.5"
                  style={{ backgroundColor: accent }}
                />
                <span
                  aria-hidden
                  className="row-span-2 flex h-8 w-8 items-center justify-center rounded-md border border-line"
                  style={{ color: accent }}
                >
                  <ModeIcon name={h.icon} />
                </span>
                <span className="font-mono text-micro tracking-[0.08em] text-muted">{h.label}</span>
                <span className="text-body-sm font-semibold">{h.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** 모드 버튼 아래 한 줄. 인원 범위가 있으면 그걸, 없으면 소요시간을 보여준다. */
function modeTagline(v: ThemeDetail) {
  const min = v.min_group_size ?? 1;
  const max = v.max_group_size;
  if (max) return `${min}~${max}인`;
  return hoursLabel(v.duration_minutes);
}

/**
 * 차이 항목 아이콘.
 *
 * ⚠️ **아는 키만 그린다.** 운영자가 오타를 내거나 새 키를 쓰면 아이콘 없이
 *    글자만 나온다 — 화면이 깨지는 것보다 낫다.
 * ⚠️ 외부 아이콘 라이브러리를 들이지 않는다. 네 개뿐이라 SVG 로 직접 그린다.
 */
function ModeIcon({ name }: { name: string | null }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0" />
          <path d="M16 6.5a3 3 0 0 1 0 5.8" />
          <path d="M18 20a6 6 0 0 0-3-5.2" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M5 4l6 6-6 6" />
          <path d="M13 18h6" />
          <path d="M19 4l-6 6 6 6" opacity="0.45" />
        </svg>
      );
    case "fun":
      return (
        <svg {...common}>
          <rect x="2.5" y="7" width="19" height="11" rx="3" />
          <path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 14h.01" />
        </svg>
      );
    case "recommend":
      return (
        <svg {...common}>
          <path d="M12 3l1.9 4.6L19 8.3l-3.6 3.3.9 4.9L12 14.2l-4.3 2.3.9-4.9L5 8.3l5.1-.7z" />
        </svg>
      );
    default:
      return null;
  }
}
