import type { MetadataRoute } from "next";
import { getListedThemes } from "@/lib/themes";

const BASE_URL = "https://www.wouldyouescape.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 회차가 아니라 테마를 싣는다. 회차마다 URL 을 만들면 내용이 거의 같은
  // 페이지가 매주 늘어나 검색엔진이 중복으로 판단한다.
  // 설계 근거: docs/08-architecture-screens-and-admin.md §1-2
  const themes = await getListedThemes();

  // ⚠️ 색인할 페이지만 싣는다 — 홈 · 컨텐츠 목록 · 테마.
  //    About·Notice·조회·약관·개인정보는 2026-09-13부터 noindex 다. 사이트맵에
  //    계속 두면 Search Console 에 "제출됐지만 noindex" 경고가 쌓인다.
  const routes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
  ];

  routes.push(
    { url: `${BASE_URL}/contents`, changeFrequency: "daily", priority: 0.8 },
    // 잠긴 테마는 싣지 않는다. 아직 안 연 것을 검색 결과로 먼저 만나면
    // "들어갔더니 자물쇠" 가 된다.
    ...themes
      .filter((t) => !t.is_locked)
      .map((t) => ({
        url: `${BASE_URL}/themes/${t.slug}`,
        lastModified: new Date(t.updated_at),
        changeFrequency: "daily" as const,
        priority: 0.9,
      }))
  );

  return routes;
}
