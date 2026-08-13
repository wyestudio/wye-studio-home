import type { MetadataRoute } from "next";
import { getUpcomingSessions } from "@/lib/sessions";

const BASE_URL = "https://wouldyouescape.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sessions = await getUpcomingSessions();

  const routes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  if (process.env.NEXT_PUBLIC_ABOUT_ENABLED === "true") {
    routes.push({
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  routes.push(
    {
      url: `${BASE_URL}/contents`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/notice`,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/lookup`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...sessions.map((session) => ({
      url: `${BASE_URL}/sessions/${session.slug}`,
      lastModified: new Date(session.created_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  );

  return routes;
}
