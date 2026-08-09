import type { MetadataRoute } from "next";

const BASE_URL = "https://wouldyouescape.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 휴면 처리된 로그인/회원가입/계정/OAuth 콜백 라우트 — 어디서도 링크되지
      // 않고 색인될 필요도 없음. 자세한 배경은 CLAUDE.md 참고.
      disallow: ["/login", "/signup", "/account", "/auth"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
