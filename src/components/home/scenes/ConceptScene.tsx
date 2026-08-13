"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";

const CIRCLES = [
  { label: "소셜", color: "bg-mascot-woodju" },
  { label: "챌린지", color: "bg-mascot-is" },
  { label: "방탈출", color: "bg-mascot-kape" },
];

export function ConceptScene({
  index = 0,
  total = 1,
  range,
}: {
  index?: number;
  total?: number;
  range?: { start: number; end: number; unitSpan?: number };
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-6 sm:gap-12">
        {CIRCLES.map((circle) => (
          <div
            key={circle.label}
            className={`flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full ${circle.color} text-lg font-bold sm:h-40 sm:w-40 sm:text-2xl`}
            style={{ color: "var(--background)" }}
          >
            {circle.label}
          </div>
        ))}
      </div>
    </SceneShell>
  );
}
