import type { Metadata } from "next";
import { ThemeShowcase, type ThemeCardData } from "@/components/contents/ThemeShowcase";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { SitePopupMount } from "@/components/promo/SitePopupMount";
import { getListedThemes, getUpcomingOpenSummary } from "@/lib/themes";

// 캐시는 데이터 쪽에 있다(src/lib/themes.ts). 아래 주석은 page.tsx 와 같은 이유.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "콘텐츠",
  // 검색 결과에 올리지 않는다(2026-09-19). 목록에 실테마가 하나뿐이라 구글이
  // 긁을 본문이 없어, 잠긴 카드의 "아직 탐사되지 않은 행성입니다" 와 푸터
  // 사업자등록번호가 사이트링크 설명으로 나갔다. 테마가 늘면 다시 켠다.
  // ⚠️ follow 는 살려둔다 — 여기 걸린 테마 링크는 크롤러가 계속 타고 가야 한다.
  robots: { index: false, follow: true },
  openGraph: { title: "우주이스케이프 | 콘텐츠" },
  twitter: { title: "우주이스케이프 | 콘텐츠" },
};

export default async function ContentsPage() {
  // 남은 회차 수 · 다음 회차만 필요하다 — 테마별 전체 회차 목록을 읽지 않는다(getUpcomingOpenSummary 주석).
  const [themes, upcoming] = await Promise.all([getListedThemes(), getUpcomingOpenSummary()]);

  const cards: ThemeCardData[] = themes.map((theme) => ({
    ...theme,
    upcomingCount: upcoming[theme.id]?.count ?? 0,
    nextStartAt: upcoming[theme.id]?.nextStartAt ?? null,
  }));

  return (
    <>
      <ThemeShowcase themes={cards} />
      <KakaoChannelButton />
      {/* 접속 팝업. 운영자가 이 화면을 노출 대상으로 고른 팝업만 뜬다. */}
      <SitePopupMount page="themes" />
    </>
  );
}
