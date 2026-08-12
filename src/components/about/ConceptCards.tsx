"use client";

import { HudCard } from "@/components/ui/HudCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

const CARDS = [
  { title: "방탈출", desc: "몰입감 있는 방탈출 콘텐츠가 대화의 자연스러운 매개체가 됩니다." },
  { title: "4인 1조 랜덤 편성", desc: "모르는 사람들과 랜덤으로 조가 편성되어 함께 미션을 풀어갑니다." },
  { title: "자연스러운 대화", desc: "게임을 함께 풀어가며 자연스럽게 서로를 알아가는 경험을 제공합니다." },
];

export function ConceptCards() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-12">
      <Reveal className="mb-8">
        <SectionHeading eyebrow="Why" title="우주이스케이프가 다른 이유" />
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.08}>
            <HudCard className="flex h-full flex-col gap-2 p-5 text-center">
              <p className="font-bold">{card.title}</p>
              <p className="text-sm text-muted">{card.desc}</p>
            </HudCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
