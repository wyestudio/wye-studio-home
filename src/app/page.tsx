import { Hero } from "@/components/home/Hero";
import { ConceptCards } from "@/components/about/ConceptCards";
import { ProcessSteps } from "@/components/contents/ProcessSteps";
import { FaqSection } from "@/components/notice/FaqSection";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function Home() {
  const sessions = await getUpcomingSessions();

  return (
    <>
      <Hero sessions={sessions} />
      <ConceptCards />
      <ProcessSteps />
      <section className="border-t border-border px-5 py-12">
        <div className="mx-auto max-w-2xl">
          <FaqSection />
        </div>
      </section>
    </>
  );
}
