import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { SessionScene } from "@/components/home/scenes/SessionScene";
import { ConceptScene } from "@/components/home/scenes/ConceptScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { SessionCard } from "@/components/home/SessionCard";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function Home() {
  const sessions = await getUpcomingSessions();

  return (
    <ScrollStage>
      <HeroScene />
      <SessionScene weight={2.5}>
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </SessionScene>
      <ConceptScene />
      <NoticeScene />
    </ScrollStage>
  );
}
