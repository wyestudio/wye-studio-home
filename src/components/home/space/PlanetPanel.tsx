"use client";

import Link from "next/link";
import { PosterImage } from "@/components/contents/PosterImage";
import { Chevron } from "@/components/ui/Chevron";
import { themeTitleFontClass } from "@/types/catalog";
import type { PlanetSlot } from "./types";

const DEFAULT_ACCENT = "#3dffb0";

/**
 * 행성을 고르면 열리는 브리핑 패널 — 예전 홈 패널(포스터 + 강조색 왼쪽 선)의 결을 그대로 두고,
 * 계기판처럼 위에 좌표줄 · 모서리 눈금을 얹었다.
 *
 * side  = 넓은 화면. 장면 오른쪽에 붙고 닫을 수 있다.
 * sheet = 휴대폰. 장면 아래에 늘 붙어 있고, 넘긴 행성을 보여 준다.
 *
 * 모드 줄은 열릴 때마다 타자 치듯 찍힌다(globals.css .briefing-row). 패널을 key 로 새로
 * 붙이면 다시 찍힌다.
 *
 * 넓은 화면(side)은 여닫을 때 홀로그램처럼 움직인다(globals.css .holo-*) — 가운데 한 줄이
 * 위아래로 펼쳐지며 열리고, 열린 뒤에는 천천히 오르내린다. 닫을 때는 거꾸로 접힌다(closing).
 * 휴대폰(sheet)은 움직이지 않는다 — 넘길 때마다 펼쳐지면 정신없다(대표님).
 * 모양(바탕 · 테두리)은 예전 패널 그대로 둔다 — 빛 번짐 · 주사선 · 기울기를 얹었다가 지저분해서 뺐다.
 */
export function PlanetPanel({
  slot,
  index,
  variant,
  active,
  onActive,
  onClose,
  closing = false,
}: {
  slot: PlanetSlot;
  index: number;
  variant: "side" | "sheet";
  active: string | null;
  onActive: (key: string | null) => void;
  onClose?: () => void;
  closing?: boolean;
}) {
  const theme = slot.kind === "theme" ? slot.theme : null;
  const locked = slot.kind === "soon" || !!theme?.is_locked;
  const accent = theme?.accent_color || DEFAULT_ACCENT;
  const orbits = locked ? [] : (theme?.orbits ?? []);
  const name = theme?.name ?? "???";
  const sheet = variant === "sheet";

  return (
    <div className={sheet ? "" : "holo-float"}>
      <section
        aria-label={`${name} 정보`}
        className={`${sheet ? "" : closing ? "holo-close" : "holo-open"} relative overflow-hidden rounded-xl border border-line-subtle bg-background/85 backdrop-blur-md ${
          sheet ? "p-4" : "p-5"
        }`}
        style={{ borderLeftColor: accent, borderLeftWidth: 2 }}
      >
        {/* 계기판 모서리 눈금 */}
        <span aria-hidden className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-line" />
        <span aria-hidden className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-line" />

        <div className="flex items-center justify-between gap-3 pr-4">
          <p className="font-mono text-micro tracking-[0.2em] text-muted">
            PLANET {String(index + 1).padStart(2, "0")}
            <span className="mx-2 text-line">/</span>
            <span style={{ color: locked ? undefined : accent }}>{locked ? "UNCHARTED" : "EXPLORABLE"}</span>
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="정보 닫기"
              data-track="홈 행성 패널 닫기"
              className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-fill hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className={`mt-3 flex gap-4 ${sheet ? "" : "sm:gap-5"}`}>
          {/* 포스터는 '미션 파일' 처럼 왼쪽에. 휴대폰은 행성이 위에 크게 있으니 빼서 높이를 아낀다. */}
          {!sheet && (
            <div className="relative aspect-[4/5] w-32 shrink-0 self-start overflow-hidden rounded-lg border border-line-subtle bg-fill-subtle">
              {theme ? (
                <PosterImage src={theme.hero_image_path} alt={`${name} 포스터`} sizes="128px" />
              ) : (
                <span className="flex h-full items-center justify-center text-h2 font-extrabold text-muted">?</span>
              )}
              {/* 잠긴 행성 — 포스터 위에도 막을 씌운다(예전 홈 패널과 같은 표시) */}
              {locked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <LockGlyph size={28} />
                </div>
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3
              className={`text-h3 font-semibold ${theme ? themeTitleFontClass(theme.title_font) : ""}`}
              style={{ color: locked ? undefined : accent }}
            >
              {name}
            </h3>

            {locked ? (
              <p className="mt-2 flex items-center gap-2 text-label text-muted">
                <LockGlyph />
                아직 탐사되지 않은 행성입니다.
              </p>
            ) : orbits.length > 0 ? (
              /* 모드 줄 — 위성과 같은 색. 줄에 올리거나 누르면 장면의 같은 위성이 밝아진다. */
              <ul className="mt-2 space-y-0.5">
                {orbits.map((o, i) => (
                  <li key={o.key} className="briefing-row" style={{ "--i": i } as React.CSSProperties}>
                    <Link
                      href={o.href}
                      prefetch={false}
                      data-track={`홈 행성 모드 → ${name} ${o.label}`}
                      onPointerEnter={() => onActive(o.key)}
                      onPointerLeave={() => onActive(null)}
                      onFocus={() => onActive(o.key)}
                      onBlur={() => onActive(null)}
                      className={`-mx-2 flex items-center gap-2 rounded-md px-2 transition-colors ${
                        sheet ? "min-h-11 py-1" : "py-1"
                      } ${active === o.key ? "bg-fill-strong" : "hover:bg-fill"}`}
                    >
                      <span className="flex items-center gap-2 whitespace-nowrap text-label font-semibold text-white">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: o.color, boxShadow: `0 0 8px ${o.color}` }}
                        />
                        {o.label}
                      </span>
                      <span className="truncate text-micro text-muted">{o.spec}</span>
                      <Chevron dir="right" className="ml-auto h-3.5 w-3.5 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {theme && !locked && (
              <Link
                href={`/themes/${theme.slug}`}
                prefetch={false}
                data-track={`홈 행성 → ${name}`}
                className="mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-label font-semibold text-background transition-opacity hover:opacity-90"
                style={{ background: accent }}
              >
                테마 자세히 보기
                <Chevron dir="right" className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}

function LockGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden>
      <rect x="4" y="9" width="16" height="14" fill="#fff" />
      <path d="M9 9V4.5h6V9" stroke="#fff" strokeWidth="2.2" fill="none" />
      <rect x="11" y="13" width="2" height="5" fill="#0a0a12" />
    </svg>
  );
}
