"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { ThemeHomeShowcase, type HomeThemeCard } from "@/components/home/ThemeHomeShowcase";

export function ThemeScene({
  index = 0,
  total = 1,
  range,
  themes,
}: {
  index?: number;
  total?: number;
  // ScrollStage가 weight prop을 보고 계산해서 넘겨주는 실제 스크롤 구간(이 컴포넌트는 weight를 직접 쓰진 않음).
  weight?: number;
  range?: { start: number; end: number; unitSpan?: number };
  themes: HomeThemeCard[];
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);

  return (
    <SceneShell
      local={local}
      reduceMotion={reduceMotion}
      index={index}
      isFirst={isFirst}
      isLast={isLast}
      variant="rise"
    >
      {/* 제목은 가운데, 목록과는 넉넉히 띄운다 — 시원시원하게 보이도록. */}
      <div className="mx-auto w-full max-w-4xl px-5 sm:px-8 lg:px-0">
        <h2 className="mb-10 text-center text-2xl font-extrabold tracking-[0.12em] sm:mb-16 sm:text-4xl">
          Planets to Escape
        </h2>
        <ThemeHomeShowcase themes={themes} />
      </div>
    </SceneShell>
  );
}
