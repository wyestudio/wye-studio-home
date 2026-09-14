import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { ThemeScene } from "@/components/home/scenes/ThemeScene";
import { InstagramScene } from "@/components/home/scenes/InstagramScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { getListedThemes, getUpcomingSessionsForTheme } from "@/lib/themes";
import type { HomeThemeCard } from "@/components/home/ThemeHomeShowcase";

// 캐시는 페이지가 아니라 데이터 쪽에 있다(src/lib/themes.ts).
// 이 페이지에 revalidate 를 걸어도 쿠키를 읽는 순간 동적으로 확정돼 무시된다.
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
      <ThemeScene weight={1.8} themes={cards} />
      <InstagramScene />
      <NoticeScene />
    </ScrollStage>
  );
}
