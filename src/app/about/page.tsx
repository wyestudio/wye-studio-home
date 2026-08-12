"use client";

import { ConceptCards } from "@/components/about/ConceptCards";
import { HudCard } from "@/components/ui/HudCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HudPlaceholder } from "@/components/ui/HudPlaceholder";
import { Reveal } from "@/components/ui/Reveal";

const PRINCIPLES = [
  { title: "술 없이 진행해요", desc: "누구나 부담 없이 즐길 수 있도록 음주를 제공하지 않아요." },
  { title: "개인정보는 암호화해 보관해요", desc: "이름·전화번호는 암호화되어 저장되고, 운영진도 필요할 때만 열람해요." },
  { title: "소개팅 회차는 성비를 관리해요", desc: "남/여 정원을 따로 두고, 정원이 안 찼을 때 자동으로 채우지 않아요." },
];

export default function AboutPage() {
  return (
    <div className="pt-10">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal className="mb-10 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-muted">Identity</p>
          <h1 className="text-2xl font-extrabold">About</h1>
        </Reveal>

        <section className="mb-8">
          <Reveal className="mb-4">
            <SectionHeading eyebrow="Story" title="브랜드 스토리" align="left" />
          </Reveal>
          <Reveal>
            <HudPlaceholder label="회사 소개 준비 중" />
          </Reveal>
        </section>

        <section className="mb-8">
          <Reveal>
            <HudCard className="flex items-center gap-4 p-5">
              <span className="animate-mascot-bob text-3xl" aria-hidden>
                🧢
              </span>
              <div>
                <p className="font-bold">케이프를 소개합니다</p>
                <p className="text-sm text-muted">
                  헤더에서 로고를 망치질하고 있는 우주이스케이프의 마스코트예요. 아직 베타라 할 일이 많아서 늘 바빠요.
                </p>
              </div>
            </HudCard>
          </Reveal>
        </section>
      </div>

      <ConceptCards />

      <div className="mx-auto max-w-3xl px-5">
        <section className="mb-8">
          <Reveal className="mb-8">
            <SectionHeading eyebrow="Principle" title="운영 원칙" />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <HudCard className="flex h-full flex-col gap-2 p-5 text-center">
                  <p className="font-bold">{p.title}</p>
                  <p className="text-sm text-muted">{p.desc}</p>
                </HudCard>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <Reveal>
            <HudCard className="p-5 text-sm">
              <p className="mb-1 font-semibold">사업자 정보</p>
              <p className="text-muted">준비 중 (회사 설립 완료 후 기재 예정)</p>
            </HudCard>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
