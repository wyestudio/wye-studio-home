import { ScrollStage } from "@/components/home/scroll-stage/ScrollStage";
import { HeroScene } from "@/components/home/scenes/HeroScene";
import { ThemeScene } from "@/components/home/scenes/ThemeScene";
import { InstagramScene } from "@/components/home/scenes/InstagramScene";
import { NoticeScene } from "@/components/home/scenes/NoticeScene";
import { getListedThemes } from "@/lib/themes";
import { attachOrbits } from "@/lib/homeOrbits";
import type { HomeThemeCard } from "@/components/home/space/types";
import { SitePopupMount } from "@/components/promo/SitePopupMount";
import { getOwnInstagramPostsSafe } from "@/lib/instagramOwn";

// 캐시는 페이지가 아니라 데이터 쪽에 있다(src/lib/themes.ts).
// 이 페이지에 revalidate 를 걸어도 쿠키를 읽는 순간 동적으로 확정돼 무시된다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [cards, instagramPosts]: [HomeThemeCard[], Awaited<ReturnType<typeof getOwnInstagramPostsSafe>>] =
    await Promise.all([getListedThemes().then(attachOrbits), getOwnInstagramPostsSafe()]);

  return (
    <>
      <ScrollStage>
        <HeroScene />
        <ThemeScene weight={1.8} themes={cards} />
        {/* 기본 폭(1)이면 머무는 구간이 화면 3분의 1 남짓이라 "슉 지나간다" 는 말을 들었다 — 행성 장면처럼 넓힌다 */}
        <InstagramScene weight={2} posts={instagramPosts} />
        <NoticeScene />
      </ScrollStage>
      {/* 접속 팝업. 운영자가 이 화면을 노출 대상으로 고른 팝업만 뜬다. */}
      <SitePopupMount page="home" />
    </>
  );
}
