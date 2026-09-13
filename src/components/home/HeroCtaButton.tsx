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
/** 빛번짐이 버튼 바깥으로 나갈 여백. SVG 를 이만큼 키워서 그 안에서 번지게 한다. */
const PAD = 22;

/**
 * 버튼 둘레를 도는 빛.
 *
 * 선은 그리지 않는다 — 빛 한 점만 공중에서 도는 것처럼 보여야 한다.
 * 같은 사각형 경로를 세 겹으로 겹쳐 번짐을 만든다(멀리 → 가까이 → 심지).
 */
function BeamBorder() {
  const rect = {
    x: PAD + 0.5,
    y: PAD + 0.5,
    width: W - 1,
    height: H - 1,
    fill: "none",
    strokeLinecap: "round" as const,
    // 길이를 100 으로 정규화해두면 dash 값을 % 처럼 쓸 수 있다.
    pathLength: 100,
  };

  return (
    <svg
      className="hero-cta-beam"
      viewBox={`0 0 ${W + PAD * 2} ${H + PAD * 2}`}
      width={W + PAD * 2}
      height={H + PAD * 2}
      aria-hidden
      focusable="false"
    >
      {/* 멀리 번지는 빛무리 */}
      <rect {...rect} className="hero-cta-beam-run hero-cta-beam-haze" stroke="#ffffff" strokeWidth={13} />
      {/* 가까운 번짐 */}
      <rect {...rect} className="hero-cta-beam-run hero-cta-beam-glow" stroke="#ffffff" strokeWidth={5} />
      {/* 심지 */}
      <rect {...rect} className="hero-cta-beam-run" stroke="#ffffff" strokeWidth={2} />
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
      {/* 호버 시 퍼지는 흰 원은 버튼 안에서만 보여야 하므로 따로 잘라둔다.
          버튼 자체는 overflow 를 열어둬야 빛번짐이 바깥으로 나간다. */}
      <span aria-hidden className="hero-cta-clip">
        <span className="hero-cta-fill" />
      </span>
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
