"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { SessionShowcase } from "@/components/home/SessionShowcase";
import type { Session } from "@/types/domain";

export function SessionScene({
  index = 0,
  total = 1,
  range,
  sessions,
}: {
  index?: number;
  total?: number;
  // ScrollStage가 weight prop을 보고 계산해서 넘겨주는 실제 스크롤 구간(이 컴포넌트는 weight를 직접 쓰진 않음).
  weight?: number;
  range?: { start: number; end: number; unitSpan?: number };
  sessions: Session[];
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
      <div className="mx-auto w-full max-w-4xl px-5 sm:px-8 lg:px-0">
        <h2 className="mb-2 text-left text-lg font-extrabold sm:mb-4 sm:text-xl">지금 신청 가능한 컨텐츠들</h2>
        <SessionShowcase sessions={sessions} dense />
      </div>
    </SceneShell>
  );
}
