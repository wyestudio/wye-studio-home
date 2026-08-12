"use client";

import type { ReactNode } from "react";
import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";

export function SessionScene({
  index = 0,
  total = 1,
  range,
  children,
}: {
  index?: number;
  total?: number;
  // ScrollStage가 weight prop을 보고 계산해서 넘겨주는 실제 스크롤 구간(이 컴포넌트는 weight를 직접 쓰진 않음).
  weight?: number;
  range?: { start: number; end: number; unitSpan?: number };
  children: ReactNode;
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
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 px-5 sm:grid-cols-2 sm:gap-6 sm:px-0">{children}</div>
    </SceneShell>
  );
}
