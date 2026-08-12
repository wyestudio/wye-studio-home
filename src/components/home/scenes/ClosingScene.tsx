"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { HudCard } from "@/components/ui/HudCard";
import { LinkButton } from "@/components/ui/Button";

const FAQS = [
  {
    q: "혼자 신청해도 되나요?",
    a: "네. 비소개팅 회차는 1인부터 최대 8인까지, 소개팅 회차는 항상 1인으로 신청할 수 있어요.",
  },
  {
    q: "환불 규정은 어떻게 되나요?",
    a: "행사 전날까지는 취소 시 환불이 가능하며, 행사 전날부터는 환불이 불가해요.",
  },
];

export function ClosingScene({
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
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-glow">Get started</p>
          <h2 className="text-[11vw] font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            지금
            <br />
            참가해보세요
          </h2>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {FAQS.map((faq) => (
            <HudCard key={faq.q} className="p-4">
              <p className="mb-1 font-semibold">{faq.q}</p>
              <p className="text-sm text-muted">{faq.a}</p>
            </HudCard>
          ))}
        </div>
        <LinkButton href="/contents">회차 보러 가기 →</LinkButton>
      </div>
    </SceneShell>
  );
}
