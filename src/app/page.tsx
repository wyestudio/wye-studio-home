import { Hero } from "@/components/home/Hero";
import { ConceptCards } from "@/components/home/ConceptCards";
import { ProcessSteps } from "@/components/home/ProcessSteps";
import { FaqPreview } from "@/components/home/FaqPreview";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function Home() {
  const sessions = await getUpcomingSessions();

  return (
    <>
      <Hero sessions={sessions} />
      <ConceptCards />
      <ProcessSteps />
      <FaqPreview />
    </>
  );
}
