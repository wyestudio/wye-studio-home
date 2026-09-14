import type { Metadata } from "next";
import { ThemeShowcase, type ThemeCardData } from "@/components/contents/ThemeShowcase";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { getListedThemes, getUpcomingSessionsForTheme } from "@/lib/themes";

// 캐시는 데이터 쪽에 있다(src/lib/themes.ts). 아래 주석은 page.tsx 와 같은 이유.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "컨텐츠",
  openGraph: { title: "우주이스케이프 | 컨텐츠" },
  twitter: { title: "우주이스케이프 | 컨텐츠" },
};

export default async function ContentsPage() {
  const themes = await getListedThemes();

  // 테마마다 남은 회차 수를 붙인다. 테마 수가 적어(한 자릿수) 순회 비용이 무의미하다.
  const cards: ThemeCardData[] = await Promise.all(
    themes.map(async (theme) => {
      const sessions = await getUpcomingSessionsForTheme(theme.id);
      const open = sessions.filter((s) => s.status === "open");
      return {
        ...theme,
        upcomingCount: open.length,
        nextStartAt: open[0]?.start_at ?? null,
      };
    })
  );

  return (
    <>
      <ThemeShowcase themes={cards} />
      <KakaoChannelButton />
    </>
  );
}
