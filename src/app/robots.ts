import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isProductionHost } from "@/lib/hosts";

const BASE_URL = "https://wouldyouescape.com";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") || "";

  // admin/test 서브도메인 등 프로덕션이 아닌 호스트는 전체 비공개 — 실제 콘텐츠는
  // proxy.ts의 인증 게이트로 이미 막혀있지만, 크롤러가 그 사실을 robots.txt로도
  // 확인할 수 있도록 명시한다.
  if (!isProductionHost(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 휴면 처리된 로그인/회원가입/계정/OAuth 콜백 라우트 — 어디서도 링크되지
      // 않고 색인될 필요도 없음. 자세한 배경은 CLAUDE.md 참고.
      // /lookup/result는 sessionStorage 없이 직접 접근 불가능하고 색인 필요 없음.
      // /openyourdream은 QR코드로만 도달하는 숨겨진 이스터에그(타로 미니게임) —
      // 사이트 어디서도 링크되지 않고, sitemap.ts에도 등록하지 않으며 색인도 불필요.
      disallow: ["/login", "/signup", "/account", "/auth", "/lookup/result", "/openyourdream"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
