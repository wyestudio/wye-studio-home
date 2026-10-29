import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { ThemeScene } from "@/components/home/scenes/ThemeScene";
import { InstagramScene } from "@/components/home/scenes/InstagramScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { getListedThemes, getUpcomingOpenSummary } from "@/lib/themes";
import type { HomeThemeCard } from "@/components/home/ThemeHomeShowcase";
import { SitePopupMount } from "@/components/promo/SitePopupMount";
import { getOwnInstagramPostsSafe } from "@/lib/instagramOwn";

// 캐시는 페이지가 아니라 데이터 쪽에 있다(src/lib/themes.ts).
// 이 페이지에 revalidate 를 걸어도 쿠키를 읽는 순간 동적으로 확정돼 무시된다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [themes, instagramPosts, upcoming] = await Promise.all([
    getListedThemes(),
    getOwnInstagramPostsSafe(),
    // 남은 회차 수만 필요하다 — 테마별 전체 회차 목록을 읽지 않는다(getUpcomingOpenSummary 주석).
    getUpcomingOpenSummary(),
  ]);

  const cards: HomeThemeCard[] = themes.map((theme) => ({
    ...theme,
    upcomingCount: upcoming[theme.id]?.count ?? 0,
  }));

  return (
    <>
      <ScrollStage>
        <HeroScene />
        <ThemeScene weight={1.8} themes={cards} />
        <InstagramScene posts={instagramPosts} />
        <NoticeScene />
      </ScrollStage>
      {/* 접속 팝업. 운영자가 이 화면을 노출 대상으로 고른 팝업만 뜬다. */}
      <SitePopupMount page="home" />
    </>
  );
}
