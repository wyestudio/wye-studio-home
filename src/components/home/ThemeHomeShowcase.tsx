"use client";

import { useState } from "react";
import Link from "next/link";
import { SpinningPlanet } from "@/components/home/SpinningPlanet";
import { DifficultyLocks } from "@/components/ui/DifficultyLocks";
import { PosterImage, FALLBACK_LOGO } from "@/components/contents/PosterImage";
import { themeTitleFontClass, type ThemeWithTiers } from "@/types/catalog";

const DEFAULT_ACCENT = "#3dffb0";

export type HomeThemeCard = ThemeWithTiers & {
  upcomingCount: number;
};

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 지그재그 한 칸이 아래로 내려가는 높이(px). 이음선 SVG 와 같은 값을 쓴다. */
const OFFSET = 112;

/**
 * 홈 — Planets to Escape.
 *
 * 행성이 자전하고 있다가 커서를 올리면 멈추고 **오른쪽에** 지령 패널이 열린다
 * (우주선 계기판에서 미션 브리핑을 받는 느낌).
 *
 * 넓은 화면에서는 행성-패널 묶음을 **지그재그로 가로로 늘어놓고** 넘치면
 * 옆으로 밀어 본다. 세로로 쌓으면 테마가 늘수록 홈이 한없이 길어진다.
 * 좁은 화면에서는 hover 가 없으므로 세로로 쌓고 패널을 늘 펼쳐 둔다.
 *
 * ⚠️ 칸 높이를 고정해 둔다(sm:h-72). 그래야 위아래로 엇갈린 칸들의 세로
 *    중심이 일치해 이음선이 정확히 행성 옆에 붙는다.
 */
export function ThemeHomeShowcase({ themes }: { themes: HomeThemeCard[]; dense?: boolean }) {
  if (themes.length === 0) {
    return (
      <div className="rounded-xl border border-white/15 bg-white/5 p-8 text-center">
        <p className="font-semibold">준비 중인 컨텐츠가 곧 공개됩니다.</p>
      </div>
    );
  }

  // 마지막 칸은 언제나 '출시 예정'. DB 에 없는 자리표시라 여기서 붙인다.
  const slots: ({ kind: "theme"; theme: HomeThemeCard } | { kind: "soon" })[] = [
    ...themes.map((theme) => ({ kind: "theme" as const, theme })),
    { kind: "soon" as const },
  ];

  return (
    <div
      className="planet-track flex flex-col gap-10 sm:h-[25rem] sm:flex-row sm:items-start
                 sm:gap-0 sm:overflow-x-auto sm:overflow-y-hidden sm:pb-4"
    >
      {slots.map((slot, i) => (
        // 지그재그 — 홀수 칸만 아래로(sm:mt-28 = OFFSET) 내린다.
        // 좁은 화면에서는 세로로 쌓이므로 어긋남 없이 그대로 붙는다.
        <div
          key={slot.kind === "theme" ? slot.theme.id : "soon"}
          className={`flex shrink-0 items-center sm:h-72 ${i % 2 === 1 ? "sm:mt-28" : ""}`}
        >
          {i > 0 && <Connector down={i % 2 === 1} />}
          {slot.kind === "theme" ? <ThemeSlot theme={slot.theme} /> : <ComingSoonSlot />}
        </div>
      ))}
    </div>
  );
}

/** 칸과 칸 사이를 잇는 점선. 좁은 화면에서는 칸이 세로로 쌓이므로 감춘다. */
function Connector({ down }: { down: boolean }) {
  const h = OFFSET * 2;
  const y1 = down ? 0 : h;
  const y2 = OFFSET;
  return (
    <svg
      width={96}
      height={h}
      viewBox={`0 0 96 ${h}`}
      className="hidden shrink-0 sm:block"
      aria-hidden
    >
      <line
        x1="0"
        y1={y1}
        x2="96"
        y2={y2}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="2"
        strokeDasharray="6 10"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 잠긴 행성·패널 한가운데에 뜨는 자물쇠. */
function LockBadge({ shaking, size = "md" }: { shaking: boolean; size?: "md" | "sm" }) {
  const px = size === "md" ? 34 : 26;
  return (
    <span
      className={`pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2
                  items-center justify-center rounded-full bg-black/55 p-2 backdrop-blur-[1px]
                  ${shaking ? "animate-lock-shake" : ""}`}
      aria-hidden
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="10" width="16" height="10" rx="2" fill="#fff" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="15" r="1.6" fill="#0a0a12" />
      </svg>
    </span>
  );
}

function ThemeSlot({ theme }: { theme: HomeThemeCard }) {
  const accent = theme.accent_color || DEFAULT_ACCENT;
  const logo = theme.logo_image_path || FALLBACK_LOGO;
  const locked = !theme.is_active;

  // 잠긴 행성을 눌렀을 때 — 자물쇠가 한 번 흔들리고 패널 문구가 잠깐 바뀐다.
  const [knocked, setKnocked] = useState(false);

  function knock() {
    setKnocked(true);
    window.setTimeout(() => setKnocked(false), 2600);
  }

  const planet = (
    <div className="group peer relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
      <SpinningPlanet
        src={logo}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
      />

      {/*
        구체 음영 — 표면과 달리 **움직이지 않는다**. 빛이 한쪽에서 고정으로
        들어오고 그 아래로 지형이 흘러가야 공이 도는 것처럼 보인다.
      */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.26) 0%, transparent 44%), " +
            "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 74%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      {locked && <LockBadge shaking={knocked} />}

      {/* 멈춘 순간 '조준됨' 을 알리는 테두리 */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full border opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ borderColor: accent, boxShadow: `0 0 24px -6px ${accent}` }}
      />
    </div>
  );

  const panel = (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-white/12 bg-white/[0.04] p-4
                 opacity-100 transition-all duration-500 sm:flex-none
                 [@media(hover:hover)]:-translate-x-3 [@media(hover:hover)]:opacity-0
                 [@media(hover:hover)]:peer-hover:translate-x-0
                 [@media(hover:hover)]:peer-hover:opacity-100
                 [@media(hover:hover)]:peer-hover:border-white/25"
      style={{ borderLeftColor: accent, borderLeftWidth: 2 }}
    >
      <div className="flex gap-4 sm:gap-5">
        {/*
          포스터는 '미션 파일' 처럼 패널 왼쪽에 끼워둔다.
          비율은 4:5 그대로 — 원본이 그 비율이라 더 세로로 늘리면 잘린다.
        */}
        <div className="relative hidden aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-lg border border-white/12 sm:block lg:w-44">
          <PosterImage src={theme.hero_image_path} alt={`${theme.name} 포스터`} sizes="176px" />
        </div>

        <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:justify-center">
          <h3
            className={`text-lg font-extrabold ${themeTitleFontClass(theme.title_font)}`}
            style={{ color: accent }}
          >
            {theme.name}
          </h3>

          {/*
            넓은 화면에서는 테마명 / 난이도 / 시간 세 줄로 선다.
            0 은 '미정' 이라 줄 자체를 감춘다 — "난이도 0/5 · 0분" 은 고장으로 읽힌다.
          */}
          {(theme.difficulty > 0 || theme.duration_minutes > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted sm:mt-2 sm:flex-col sm:items-start sm:gap-y-1.5">
              {theme.difficulty > 0 && <DifficultyLocks rating={theme.difficulty} />}
              {theme.duration_minutes > 0 && <span>⏱ {durationLabel(theme.duration_minutes)}</span>}
            </div>
          )}

          {locked && (
            <p className="mt-1.5 text-xs text-muted">
              {knocked ? "아직 탈출할 수 없는 행성입니다." : "아직 탐사되지 않은 행성입니다."}
            </p>
          )}
        </div>
      </div>

      {/* 패널도 한가운데에 자물쇠. 옅은 막을 깔아야 내용 위에 붙은 스티커가
          아니라 '덮여 있다' 로 읽힌다. */}
      {locked && (
        <div className="pointer-events-none absolute inset-0 bg-black/25">
          <LockBadge shaking={knocked} size="sm" />
        </div>
      )}
    </div>
  );

  // 잠긴 테마는 링크가 아니다 — 눌러도 상세로 가지 않고 자물쇠만 흔든다.
  if (locked) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`${theme.name} — 아직 탈출할 수 없는 행성입니다`}
        onClick={knock}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            knock();
          }
        }}
        className="flex cursor-not-allowed items-center gap-6 sm:gap-10"
      >
        {planet}
        {panel}
      </div>
    );
  }

  return (
    <Link href={`/themes/${theme.slug}`} className="flex items-center gap-6 sm:gap-10">
      {planet}
      {panel}
    </Link>
  );
}

/**
 * 출시 예정 자리.
 *
 * 검은 실루엣에 물음표만. hover 도 클릭도 받지 않는다.
 * 좁은 화면에서는 hover 가 없어 아무것도 안 보이므로 'COMING SOON' 만 띄운다.
 */
function ComingSoonSlot() {
  return (
    <div className="flex cursor-not-allowed select-none items-center gap-6 sm:gap-10" aria-label="출시 예정">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
        {/* 완전히 검은 실루엣. 배경에 묻히지 않게 테두리만 아주 옅게 남긴다. */}
        <div
          className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10"
          style={{
            background:
              "radial-gradient(circle at 34% 30%, rgba(255,255,255,0.07) 0%, transparent 45%), " +
              "radial-gradient(circle at 50% 50%, #14141c 0%, #08080d 70%, #000 100%)",
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-white/85 sm:text-3xl">
          ?
        </span>
      </div>

      {/* 넓은 화면에서는 패널 자체가 없다. 좁은 화면에서만 한 줄. */}
      <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 p-4 text-center sm:hidden">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/45">COMING SOON</p>
      </div>
    </div>
  );
}
