import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { SessionScene } from "@/components/home/scenes/SessionScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { SessionCardFan } from "@/components/home/SessionCardFan";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function Home() {
  const sessions = await getUpcomingSessions();

  return (
    <ScrollStage>
      <HeroScene />
      <SessionScene weight={2.5}>
        <SessionCardFan sessions={sessions} />
      </SessionScene>
      <NoticeScene />
    </ScrollStage>
  );
}
