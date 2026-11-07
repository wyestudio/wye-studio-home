import type { MetadataRoute } from "next";
import { publicThemePaths } from "@/lib/publicThemePaths";

const BASE_URL = "https://www.wouldyouescape.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 회차가 아니라 테마를 싣는다. 회차마다 URL 을 만들면 내용이 거의 같은
  // 페이지가 매주 늘어나 검색엔진이 중복으로 판단한다.
  // 설계 근거: docs/08-architecture-screens-and-admin.md §1-2
  const themes = await publicThemePaths();

  // ⚠️ 색인할 페이지만 싣는다 — 홈 · Notice · 신청내역 조회 · 테마.
  //    About·약관·개인정보·컨텐츠 목록은 noindex 다(컨텐츠는 2026-09-19부터,
  //    잠긴 카드 문구가 사이트링크 설명으로 나가서). 사이트맵에 계속 두면
  //    Search Console 에 "제출됐지만 noindex" 경고가 쌓인다.
  const routes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
  ];

  routes.push(
    { url: `${BASE_URL}/notice`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/lookup`, changeFrequency: "monthly", priority: 0.5 },
    // 단체 예약 안내. "단체 방탈출" 로 검색해 바로 들어오는 길이 필요하다 —
    // 테마 상세를 거쳐야만 닿으면 단체를 찾는 사람은 애초에 들어오지 않는다.
    { url: `${BASE_URL}/group`, changeFrequency: "monthly", priority: 0.7 },
    // 잠긴 테마 · 모드별 주소 규칙은 publicThemePaths() 에 있다(IndexNow 와 같이 쓴다)
    ...themes.map((t) => ({
      url: `${BASE_URL}${t.path}`,
      lastModified: new Date(t.updatedAt),
      changeFrequency: "daily" as const,
      priority: t.isMode ? 0.8 : 0.9,
    }))
  );

  return routes;
}
