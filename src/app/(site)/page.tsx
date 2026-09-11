import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { ThemeScene } from "@/components/home/scenes/ThemeScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { getListedThemes, getUpcomingSessionsForTheme } from "@/lib/themes";
import type { HomeThemeCard } from "@/components/home/ThemeHomeShowcase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const themes = await getListedThemes();

  // 테마 수가 적어(한 자릿수) 순회 비용이 무의미하다.
  const cards: HomeThemeCard[] = await Promise.all(
    themes.map(async (theme) => {
      const sessions = await getUpcomingSessionsForTheme(theme.id);
      return { ...theme, upcomingCount: sessions.filter((s) => s.status === "open").length };
    })
  );

  return (
    <ScrollStage>
      <HeroScene />
      <ThemeScene weight={2.5} themes={cards} />
      <NoticeScene />
    </ScrollStage>
  );
}
