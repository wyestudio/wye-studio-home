"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { MascotOrbit } from "@/components/space/MascotOrbit";
import { MascotFreeRoam } from "@/components/space/MascotFreeRoam";
import { HeroCtaButton } from "@/components/home/HeroCtaButton";
import { clamp01 } from "@/lib/motion";
import { useIsMobileViewport } from "@/lib/useIsMobileViewport";

export function HeroScene({
  index = 0,
  total = 1,
  range,
}: {
  index?: number;
  total?: number;
  range?: { start: number; end: number; unitSpan?: number };
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);
  const mascotProgress = clamp01((local - 0.7) / 0.3);
  const isMobile = useIsMobileViewport();

  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [contentRadius, setContentRadius] = useState(0);

  useEffect(() => {
    const wrapper = contentWrapperRef.current;
    if (!wrapper) return;

    function measure() {
      const w = wrapper!.offsetWidth;
      const h = wrapper!.offsetHeight;
      if (w > 0 && h > 0) {
        const radius = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2);
        setContentRadius(radius);
      }
    }

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      {reduceMotion || !isMobile ? (
        <MascotOrbit progress={mascotProgress} reduceMotion={reduceMotion} minRadius={contentRadius} />
      ) : (
        <MascotFreeRoam progress={mascotProgress} reduceMotion={reduceMotion} contentRef={contentWrapperRef} />
      )}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center">
        <div ref={contentWrapperRef} className="inline-flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo-white.png"
            alt="Would You Escape"
            width={138}
            height={96}
            priority
            className="h-[4.6rem] w-auto sm:h-[6.6rem]"
          />
          <h1 className="text-[2rem] font-semibold tracking-tight text-foreground sm:text-[3rem]">
            would you escape?
          </h1>
          <HeroCtaButton />
        </div>


      </div>

      {/*
        스크롤 안내.
        ⚠️ absolute 로 띄운다. 흐름에 두면 로고·문구·YES 묶음의 세로 가운데가
           이것 때문에 위로 밀린다. 정중앙은 그대로 두고 안내만 아래에 둔다.
        히어로가 빠져나갈 때 같이 사라져야 하므로 SceneShell 안에 둔다
        (SceneShell 이 씬 전체 투명도를 관리한다 — 따로 계산하지 않는다).
      */}
      <ScrollCue />
    </SceneShell>
  );
}

/**
 * "아래로 더 있다"는 표시.
 *
 * 첫 화면만 보고 나가는 사람이 있어 넣었다. 장식 요소라 클릭은 받지 않는다
 * (히어로 래퍼가 pointer-events-none 이고 여기서 되살리지 않는다 — 되살리면
 *  겹쳐 쌓인 다른 씬의 클릭까지 가로챈다).
 */
function ScrollCue() {
  return (
    <div
      aria-hidden
      className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-10"
    >
      {/* 얇아서 안 보인다는 제보(2026-09-14) — 굵기·크기를 올리고 별 배경에서도
          읽히도록 어두운 그림자를 깔았다. */}
      <span
        className="font-mono text-xs font-bold tracking-[0.38em] text-white"
        style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}
      >
        SCROLL
      </span>
      <span className="scroll-cue-rail" />
    </div>
  );
}
