"use client";

import Link from "next/link";
import { useRef } from "react";

// 호버 시 커서가 들어온 지점에서 흰 원이 퍼지며 배경이 하얗게 뒤집히는 연출
// (21st.dev "Origin Button" 참고) — --origin-x/y를 진입 지점으로 세팅해두면
// CSS transition이 그 점을 중심으로 원을 확대한다.
function handlePointerEnter(e: React.PointerEvent<HTMLAnchorElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--origin-x", `${e.clientX - rect.left}px`);
  el.style.setProperty("--origin-y", `${e.clientY - rect.top}px`);
}

/**
 * 버튼 크기를 숫자로 고정한다.
 *
 * ⚠️ 테두리를 도는 빛이 **일정한 속도**로 움직이려면, 선을 그리는 SVG 의 좌표계가
 *    실제 픽셀 크기와 같아야 한다. 크기가 글자에 따라 달라지면 SVG 가 늘어나면서
 *    가로변과 세로변의 속도가 달라진다.
 */
const W = 170;
const H = 52;

/** 선을 도는 빛. 같은 사각형을 세 번 그린다 — 바탕선 / 잔광 / 빛. */
function BeamBorder() {
  const rect = {
    x: 0.5,
    y: 0.5,
    width: W - 1,
    height: H - 1,
    fill: "none",
    // 길이를 100 으로 정규화해두면 dash 값을 % 처럼 쓸 수 있다.
    pathLength: 100,
  };

  return (
    <svg
      className="hero-cta-beam"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden
      focusable="false"
    >
      {/* 항상 보이는 단일 선 */}
      <rect {...rect} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
      {/* 잔광 — 같은 선 위를 같은 속도로 돈다 */}
      <rect
        {...rect}
        className="hero-cta-beam-run hero-cta-beam-glow"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* 빛 */}
      <rect
        {...rect}
        className="hero-cta-beam-run"
        stroke="#ffffff"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeroCtaButton() {
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <Link
      ref={ref}
      href="/contents"
      onPointerEnter={handlePointerEnter}
      style={{ width: W, height: H }}
      className="hero-cta-button pointer-events-auto relative inline-flex items-center justify-center text-[1.1rem] font-semibold tracking-wide text-white"
    >
      <BeamBorder />
      <span aria-hidden className="hero-cta-fill" />
      <span className="hero-cta-label-default relative z-10 inline-flex items-center gap-4">
        <span aria-hidden className="hero-cta-arrow" />
        YES
      </span>
      {/* 호버 라벨은 버튼 전체 폭 기준 정중앙에 오게 absolute + inset-0 으로 독립시킨다.
          기본 라벨(화살표 + YES)보다 글자가 길어서, 흐름에 두면 폭이 출렁인다. */}
      <span
        aria-hidden
        className="hero-cta-label-hover absolute inset-0 z-10 flex items-center justify-center"
      >
        참여하기
      </span>
    </Link>
  );
}
