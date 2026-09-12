"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Slot = { kind: "theme"; theme: HomeThemeCard } | { kind: "soon" };

/**
 * 홈 — Planets to Escape.
 *
 * 행성이 자전하고 있다가 커서를 올리면 멈추고 **오른쪽에** 지령 패널이 열린다
 * (우주선 계기판에서 미션 브리핑을 받는 느낌).
 *
 * 넓은 화면에서는 행성-패널 묶음을 **지그재그로 가로로 늘어놓고**, 넘치면
 * 잡아서 옆으로 민다. 스크롤 막대는 감춘다 — 우주를 훑는 느낌이라 막대가
 * 보이면 '목록' 처럼 읽힌다. 좁은 화면에서는 hover 가 없으므로 세로로 쌓고
 * 패널을 늘 펼쳐 둔다.
 */
export function ThemeHomeShowcase({ themes }: { themes: HomeThemeCard[]; dense?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const planetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  /**
   * 이음선은 **행성 중심끼리** 잇는다.
   *
   * ⚠️ 칸 사이 빈틈에 고정 크기 SVG 를 끼워 넣었더니, 패널이 안 뜬 평소 상태에서
   *    점선만 허공에 동동 떠 보였다. 실제 행성 위치를 재서 그려야 한다.
   *    같은 스크롤 컨테이너 안이라 getBoundingClientRect 차이는 스크롤과 무관하다.
   */
  const measure = useCallback(() => {
    const host = contentRef.current;
    if (!host) return;
    const hostBox = host.getBoundingClientRect();
    const pts = planetRefs.current
      .filter((el): el is HTMLDivElement => el !== null)
      .map((el) => {
        const b = el.getBoundingClientRect();
        return { x: b.left - hostBox.left + b.width / 2, y: b.top - hostBox.top + b.height / 2 };
      });
    setLines(pts.slice(1).map((p, i) => ({ x1: pts[i].x, y1: pts[i].y, x2: p.x, y2: p.y })));
  }, []);

  useEffect(() => {
    measure();
    const host = contentRef.current;
    const ro = new ResizeObserver(measure);
    if (host) ro.observe(host);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, themes.length]);

  // 잡아서 미는 슬라이드. 막대가 없으니 끌 수 있어야 한다.
  const drag = useRef<{ x: number; left: number } | null>(null);
  const moved = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return; // 터치는 브라우저 기본 스크롤에 맡긴다
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    drag.current = { x: e.clientX, left: el.scrollLeft };
    moved.current = 0;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || !drag.current) return;
    const dx = e.clientX - drag.current.x;
    moved.current = Math.max(moved.current, Math.abs(dx));
    el.scrollLeft = drag.current.left - dx;
  }

  function endDrag() {
    drag.current = null;
  }

  // 끌고 난 직후의 클릭은 삼킨다 — 밀다가 손을 떼면 상세로 넘어가 버린다.
  function onClickCapture(e: React.MouseEvent) {
    if (moved.current > 5) {
      e.preventDefault();
      e.stopPropagation();
    }
    moved.current = 0;
  }

  if (themes.length === 0) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-white/15 bg-white/5 p-8 text-center">
        <p className="font-semibold">준비 중인 컨텐츠가 곧 공개됩니다.</p>
      </div>
    );
  }

  // 마지막 칸은 언제나 '출시 예정'. DB 에 없는 자리표시라 여기서 붙인다.
  const slots: Slot[] = [
    ...themes.map((theme) => ({ kind: "theme" as const, theme })),
    { kind: "soon" as const },
  ];

  return (
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      className="planet-track w-full overflow-x-auto overflow-y-hidden
                 px-5 sm:cursor-grab sm:px-8 sm:active:cursor-grabbing
                 lg:pl-[max(2rem,calc((100%-56rem)/2))] lg:pr-8"
    >
      <div
        ref={contentRef}
        className="relative flex w-full flex-col gap-10 sm:h-[33rem] sm:w-max sm:min-w-full sm:flex-row sm:items-start sm:gap-0 lg:h-[35rem]"
      >
        {/* 행성끼리 잇는 점선 */}
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" aria-hidden>
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="3"
              strokeDasharray="7 12"
              strokeLinecap="round"
            />
          ))}
        </svg>

        {slots.map((slot, i) => (
          // 지그재그 — 홀수 칸만 아래로 내린다. 좁은 화면에서는 세로로 쌓인다.
          <div
            key={slot.kind === "theme" ? slot.theme.id : "soon"}
            className={`relative flex shrink-0 items-center sm:h-56 lg:h-64 ${
              i > 0 ? "sm:-ml-32" : ""
            } ${i % 2 === 1 ? "sm:mt-[300px]" : ""}`}
          >
            {slot.kind === "theme" ? (
              <ThemeSlot
                theme={slot.theme}
                planetRef={(el) => {
                  planetRefs.current[i] = el;
                }}
              />
            ) : (
              <ComingSoonSlot
                planetRef={(el) => {
                  planetRefs.current[i] = el;
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 자물쇠 아이콘. 모서리를 굴리지 않는다 — 각진 쪽이 우주선 계기판 느낌에 맞는다.
 *
 * ⚠️ 흔들기는 **이 요소**에만 건다. 가운데 맞춤을 하는 바깥 요소에 걸면
 *    Tailwind 의 translate 속성과 애니메이션의 transform 이 겹쳐 좌상단으로 튄다.
 */
function LockIcon({ shaking, px = 34 }: { shaking: boolean; px?: number }) {
  return (
    <span className={`block ${shaking ? "animate-lock-shake" : ""}`} aria-hidden>
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        shapeRendering="crispEdges"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8))" }}
      >
        <rect x="5" y="9" width="14" height="14" fill="#fff" />
        <path d="M9 9V4.5h6V9" stroke="#fff" strokeWidth="2.2" strokeLinecap="butt" fill="none" />
        <rect x="11" y="13" width="2" height="5" fill="#0a0a12" />
      </svg>
    </span>
  );
}

/** 행성 한가운데의 자물쇠. */
function LockBadge({ shaking, px = 34 }: { shaking: boolean; px?: number }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
      <LockIcon shaking={shaking} px={px} />
    </span>
  );
}

/** 잠긴 자리를 덮는 어두운 막. 행성이든 패널이든 '통째로 꺼져 있음' 을 만든다. */
function LockedVeil({ rounded }: { rounded: string }) {
  return <div className={`pointer-events-none absolute inset-0 bg-black/55 ${rounded}`} />;
}

function ThemeSlot({
  theme,
  planetRef,
}: {
  theme: HomeThemeCard;
  planetRef: (el: HTMLDivElement | null) => void;
}) {
  const accent = theme.accent_color || DEFAULT_ACCENT;
  const logo = theme.logo_image_path || FALLBACK_LOGO;
  const locked = !theme.is_active;

  // 잠긴 행성을 눌렀을 때 — 자물쇠가 제자리에서 한 번 튕기고 패널 문구가 잠깐 바뀐다.
  const [knocked, setKnocked] = useState(false);

  function knock() {
    // 연달아 눌러도 다시 흔들리도록 잠깐 껐다 켠다.
    // ⚠️ requestAnimationFrame 을 쓰면 안 된다 — 배경 탭에서 아예 돌지 않는다.
    setKnocked(false);
    window.setTimeout(() => setKnocked(true), 0);
    window.setTimeout(() => setKnocked(false), 2600);
  }

  const planet = (
    <div
      ref={planetRef}
      className="group peer relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24"
    >
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

      {locked && (
        <>
          <LockedVeil rounded="rounded-full" />
          <LockBadge shaking={knocked} />
        </>
      )}

      {/* 멈춘 순간 '조준됨' 을 알리는 테두리 — 잠긴 행성에는 켜지 않는다. */}
      {!locked && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full border opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ borderColor: accent, boxShadow: `0 0 24px -6px ${accent}` }}
        />
      )}
    </div>
  );

  const panel = (
    <div
      className="relative flex min-h-28 min-w-0 flex-1 items-center overflow-hidden rounded-xl
                 border border-white/12 bg-background p-4 opacity-100 transition-all duration-500
                 sm:min-h-0 sm:flex-none
                 [@media(hover:hover)]:-translate-x-3 [@media(hover:hover)]:opacity-0
                 [@media(hover:hover)]:peer-hover:translate-x-0
                 [@media(hover:hover)]:peer-hover:opacity-100
                 [@media(hover:hover)]:peer-hover:border-white/25"
      style={{ borderLeftColor: accent, borderLeftWidth: 2 }}
    >
      <div className="flex w-full gap-4 sm:gap-5">
        {/*
          포스터는 '미션 파일' 처럼 패널 왼쪽에 끼워둔다.
          비율은 4:5 그대로 — 원본이 그 비율이라 더 세로로 늘리면 잘린다.
        */}
        <div className="relative hidden aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-lg border border-white/12 sm:block lg:w-44">
          <PosterImage src={theme.hero_image_path} alt={`${theme.name} 포스터`} sizes="176px" />
        </div>

        <div className="min-w-0 flex-1 sm:flex sm:w-44 sm:flex-none sm:flex-col sm:justify-center">
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

        </div>
      </div>

      {/* 자물쇠와 같은 선상, 바로 아래에 문구. 본문에 두면 자물쇠에 가려 읽히지 않는다. */}
      {locked && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/55">
          <LockIcon shaking={knocked} px={30} />
          <p className="px-3 text-center text-xs font-medium text-white">
            아직 탈출할 수 없는 행성입니다.
          </p>
        </div>
      )}
    </div>
  );

  // 잠긴 테마는 링크가 아니다 — 눌러도 상세로 가지 않고 자물쇠만 튕긴다.
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
        className="flex w-full cursor-not-allowed items-center gap-6 sm:w-auto sm:gap-6"
      >
        {planet}
        {panel}
      </div>
    );
  }

  return (
    <Link
      href={`/themes/${theme.slug}`}
      className="flex w-full items-center gap-6 sm:w-auto sm:gap-6"
    >
      {planet}
      {panel}
    </Link>
  );
}

/**
 * 출시 예정 자리.
 *
 * 회색 실루엣에 물음표만. hover 도 클릭도 받지 않는다.
 * 좁은 화면에서는 hover 가 없어 아무것도 안 보이므로 'COMING SOON' 만 띄운다.
 */
function ComingSoonSlot({ planetRef }: { planetRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      className="flex w-full cursor-not-allowed select-none items-center gap-6 sm:w-auto sm:gap-6"
      aria-label="출시 예정"
    >
      <div
        ref={planetRef}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24"
      >
        <div
          className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10"
          style={{
            background:
              "radial-gradient(circle at 34% 30%, rgba(255,255,255,0.16) 0%, transparent 48%), " +
              "radial-gradient(circle at 50% 50%, #5b5b66 0%, #3a3a44 62%, #26262e 100%)",
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-white/70 sm:text-3xl">
          ?
        </span>
      </div>

      {/* 넓은 화면에서는 패널 자체가 없다. 좁은 화면에서만 한 줄. */}
      <div className="flex min-h-28 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-black/40 p-4 sm:hidden">
        <p className="text-xs font-medium text-white/55">미탐사된 행성입니다.</p>
      </div>
    </div>
  );
}
