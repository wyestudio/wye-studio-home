"use client";

import { useState } from "react";
import Link from "next/link";
import { PosterImage } from "@/components/contents/PosterImage";

/**
 * 잠긴 테마 위에 올리는 자물쇠.
 * 홈(ThemeHomeShowcase)의 자물쇠와 같은 모양·같은 크기 규칙을 쓴다 —
 * 같은 "아직 못 여는 것" 인데 목록과 홈이 다르게 생기면 안 된다.
 *
 * ⚠️ 흔들기는 **이 요소**에만 건다. 가운데 맞춤(translate)을 하는 바깥 요소에
 *    걸면 Tailwind 의 translate 와 애니메이션의 transform 이 겹쳐 좌상단으로
 *    튄다 — 홈에서 실제로 그랬다.
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
        <rect x="4" y="9" width="16" height="14" fill="#fff" />
        <path d="M9 9V4.5h6V9" stroke="#fff" strokeWidth="2.2" strokeLinecap="butt" fill="none" />
        <rect x="11" y="13" width="2" height="5" fill="#0a0a12" />
      </svg>
    </span>
  );
}

export type ThemeCardProps = {
  name: string;
  slug: string;
  posterPath: string | null;
  difficulty: number;
  durationMinutes: number;
  /** 테마마다 다른 제목 글꼴 클래스 */
  titleFontClass: string;
  locked: boolean;
};

/* 모서리는 둥글리지 않는다 — 각진 쪽이 더 정제돼 보인다는 결정. */
const BASE =
  "basis-[calc((100%-1.25rem)/2)] overflow-hidden border border-white/12 bg-white/[0.03] " +
  "sm:basis-[calc((100%-2.5rem)/3)] lg:basis-[calc((100%-3.75rem)/4)]";

/** 테마 목록의 포스터 카드 한 장. */
export function ThemeCard({
  name,
  slug,
  posterPath,
  difficulty,
  durationMinutes,
  titleFontClass,
  locked,
}: ThemeCardProps) {
  // 잠긴 카드를 눌렀을 때 — 자물쇠가 제자리에서 한 번 튕긴다(홈과 같은 반응).
  const [knocked, setKnocked] = useState(false);

  function knock() {
    // 연달아 눌러도 다시 흔들리도록 잠깐 껐다 켠다.
    // ⚠️ requestAnimationFrame 을 쓰면 안 된다 — 배경 탭에서 아예 돌지 않는다.
    setKnocked(false);
    window.setTimeout(() => setKnocked(true), 0);
    window.setTimeout(() => setKnocked(false), 2600);
  }

  const body = (
    <>
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white/[0.02]">
        <PosterImage
          src={posterPath}
          alt={`${name} 포스터`}
          sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
        />
        {/*
          잠긴 테마는 홈의 'Planets to Escape' 와 같은 방식으로 가린다 —
          포스터 전체에 어두운 베일을 덮고 자물쇠를 올린다.
        */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a12]/70">
            <LockIcon shaking={knocked} />
          </div>
        )}
      </div>

      <div className="border-t border-white/12 p-3">
        {/* 글꼴은 테마마다 다르다 — 어드민에서 고른다. */}
        <p className={`truncate text-base font-bold text-white ${titleFontClass}`}>{name}</p>
        {/* 0 은 '미정' 이라 감춘다 — "난이도 0 · 0분" 은 고장으로 읽힌다. */}
        {(difficulty > 0 || durationMinutes > 0) && (
          <p className="mt-1.5 text-xs text-muted">
            {[
              difficulty > 0 ? `🔒 난이도 ${difficulty}` : null,
              durationMinutes > 0 ? `⏱ ${durationMinutes}분` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {locked && <p className="mt-1 text-xs text-muted">아직 탐사되지 않은 행성입니다</p>}
      </div>
    </>
  );

  // ⚠️ 잠긴 테마는 Link 로 감싸지 않는다. pointer-events 로만 막으면 키보드
  //    Tab 이동이나 우클릭 '새 탭에서 열기' 로 그대로 들어가진다. 아예 링크가
  //    아니어야 확실히 막힌다(홈의 잠긴 행성과 같은 처리).
  //    대신 눌리기는 해야 한다 — 아무 반응도 없으면 고장으로 읽힌다.
  if (locked) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`${name} — 아직 탈출할 수 없는 행성입니다`}
        onClick={knock}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            knock();
          }
        }}
        className={`${BASE} cursor-not-allowed select-none`}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/themes/${slug}`}
      className={`group ${BASE} transition-colors duration-200 hover:border-white/30`}
    >
      {body}
    </Link>
  );
}
