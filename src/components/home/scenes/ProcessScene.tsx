"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";

const STEPS = [
  { n: "01", label: "참가 신청", desc: "온라인으로 3분" },
  { n: "02", label: "조 편성", desc: "신청 확정 시 자동 안내" },
  { n: "03", label: "방탈출 참가", desc: "회차 시간에 현장 참여" },
  { n: "04", label: "(확장) 애프터", desc: "추후 도입 예정", muted: true },
];

export function ProcessScene({
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
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-glow">How it works</p>
        <h2 className="mb-10 text-[10vw] font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          진행 방식
        </h2>
        <ol className="flex flex-col gap-6 border-l border-glass-border pl-6">
          {STEPS.map((step) => (
            <li key={step.n} className={`relative ${step.muted ? "text-muted" : ""}`}>
              <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-glow bg-brand-soft text-[11px] font-bold text-glow shadow-[0_0_10px_-2px_var(--glow)]">
                {step.n}
              </span>
              <p className="font-bold">{step.label}</p>
              <p className="text-sm text-muted">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </SceneShell>
  );
}
