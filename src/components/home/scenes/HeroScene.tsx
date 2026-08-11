"use client";

import Image from "next/image";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { MascotOrbit } from "@/components/space/MascotOrbit";
import { clamp01 } from "@/lib/motion";

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
  // SceneShell의 fade variant가 로고/텍스트에 쓰는 exit 구간(0.7~1)과 정확히 맞춰서,
  // 마스코트 궤도와 로고가 따로따로가 아니라 동시에 페이드아웃되도록 함.
  const mascotProgress = clamp01((local - 0.7) / 0.3);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      <MascotOrbit progress={mascotProgress} reduceMotion={reduceMotion} />
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-3 text-center">
        <Image
          src="/logo-white.png"
          alt="Would You Escape"
          width={138}
          height={96}
          priority
          className="h-14 w-auto sm:h-20"
        />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
          would you escape?
        </h1>
      </div>
    </SceneShell>
  );
}
