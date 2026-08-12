"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { HudCard } from "@/components/ui/HudCard";

const POINTS = [
  {
    title: "방탈출",
    desc: "몰입감 있는 방탈출 콘텐츠가 대화의 자연스러운 매개체가 됩니다.",
  },
  {
    title: "4인 1조 랜덤 편성",
    desc: "모르는 사람들과 랜덤으로 조가 편성되어 함께 미션을 풀어갑니다.",
  },
  {
    title: "자연스러운 대화",
    desc: "게임을 함께 풀어가며 자연스럽게 서로를 알아가는 경험을 제공합니다.",
  },
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
      <div className="mx-auto grid w-full max-w-5xl gap-10 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-glow">Why</p>
          <h2 className="text-[10vw] font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
            왜
            <br />
            우주이스케이프인가
          </h2>
          <p className="mt-4 text-xs text-muted">이런 공간에서 진행돼요 · 사진 준비 중</p>
        </div>
        <ul className="flex flex-col gap-3">
          {POINTS.map((point) => (
            <li key={point.title}>
              <HudCard className="p-4">
                <p className="font-bold">{point.title}</p>
                <p className="text-sm text-muted">{point.desc}</p>
              </HudCard>
            </li>
          ))}
        </ul>
      </div>
    </SceneShell>
  );
}
