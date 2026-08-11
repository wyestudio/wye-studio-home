import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { PersonaChips } from "@/components/home/PersonaChips";
import { SpacePreview } from "@/components/home/SpacePreview";
import { ConceptCards } from "@/components/about/ConceptCards";
import { ProcessSteps } from "@/components/contents/ProcessSteps";
import { FaqSection } from "@/components/notice/FaqSection";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function Home() {
  const sessions = await getUpcomingSessions();

  return (
    <>
      <Hero sessions={sessions} />
      <PersonaChips />
      <ConceptCards />
      <SpacePreview />
      <ProcessSteps />

      <div className="mx-auto max-w-2xl px-5">
        <Link
          href="/about"
          className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-sm transition-colors hover:border-brand"
        >
          <span>
            <span className="font-semibold">우주이스케이프를 만드는 사람들</span>
            <span className="ml-1 text-muted">이 궁금하다면</span>
          </span>
          <span className="text-brand">About →</span>
        </Link>
      </div>

      <section className="border-t border-border px-5 py-12">
        <div className="mx-auto max-w-2xl">
          <FaqSection />
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-xl bg-brand-soft p-6 text-center">
          <p className="font-bold">이번 시즌은 단 2회차예요</p>
          <p className="text-sm text-muted">정원이 차면 이번 시즌은 마감돼요. 지금 바로 신청해보세요.</p>
          <a href="#sessions" className="text-sm font-semibold text-brand underline">
            회차 보러 가기 ↑
          </a>
        </div>
      </section>
    </>
  );
}
