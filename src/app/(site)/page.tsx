import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { SessionScene } from "@/components/home/scenes/SessionScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function Home() {
  const sessions = await getUpcomingSessions();

  return (
    <ScrollStage>
      <HeroScene />
      <SessionScene weight={2.5} sessions={sessions} />
      <NoticeScene />
    </ScrollStage>
  );
}
