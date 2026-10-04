import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { ThemeScene } from "@/components/home/scenes/ThemeScene";
import { InstagramScene } from "@/components/home/scenes/InstagramScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { getListedThemes, getPublicSessionsForTheme, upcomingOpenSessions } from "@/lib/themes";
import type { HomeThemeCard } from "@/components/home/ThemeHomeShowcase";
import { SitePopupMount } from "@/components/promo/SitePopupMount";

// 캐시는 페이지가 아니라 데이터 쪽에 있다(src/lib/themes.ts).
// 이 페이지에 revalidate 를 걸어도 쿠키를 읽는 순간 동적으로 확정돼 무시된다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const themes = await getListedThemes();

  // 테마 수가 적어(한 자릿수) 순회 비용이 무의미하다.
  const cards: HomeThemeCard[] = await Promise.all(
    themes.map(async (theme) => {
      // ⚠️ 목록에는 지난 회차도 들어 있다(테마 상세 달력의 이력용).
      //    여기서 걸러야 "남은 회차" 가 부풀지 않는다.
      const sessions = await getPublicSessionsForTheme(theme.id);
      return { ...theme, upcomingCount: upcomingOpenSessions(sessions).length };
    })
  );

  return (
    <>
      <ScrollStage>
        <HeroScene />
        <ThemeScene weight={1.8} themes={cards} />
        <InstagramScene />
        <NoticeScene />
      </ScrollStage>
      {/* 접속 팝업. 운영자가 이 화면을 노출 대상으로 고른 팝업만 뜬다. */}
      <SitePopupMount page="home" />
    </>
  );
}
