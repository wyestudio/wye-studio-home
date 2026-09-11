import type { MetadataRoute } from "next";
import { getListedThemes } from "@/lib/themes";

const BASE_URL = "https://www.wouldyouescape.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 회차가 아니라 테마를 싣는다. 회차마다 URL 을 만들면 내용이 거의 같은
  // 페이지가 매주 늘어나 검색엔진이 중복으로 판단한다.
  // 설계 근거: docs/08-architecture-screens-and-admin.md §1-2
  const themes = await getListedThemes();

  const routes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
  ];

  if (process.env.NEXT_PUBLIC_ABOUT_ENABLED === "true") {
    routes.push({ url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 });
  }

  routes.push(
    { url: `${BASE_URL}/contents`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/notice`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/lookup`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...themes.map((t) => ({
      url: `${BASE_URL}/themes/${t.slug}`,
      lastModified: new Date(t.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.9,
    }))
  );

  return routes;
}
