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
    </SceneShell>
  );
}
