import type { MetadataRoute } from "next";
import { getListedThemes, getThemeVariants } from "@/lib/themes";
import { modeHref } from "@/app/(site)/themes/[slug]/ModeBox";

const BASE_URL = "https://www.wouldyouescape.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 회차가 아니라 테마를 싣는다. 회차마다 URL 을 만들면 내용이 거의 같은
  // 페이지가 매주 늘어나 검색엔진이 중복으로 판단한다.
  // 설계 근거: docs/08-architecture-screens-and-admin.md §1-2
  const themes = await getListedThemes();

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

  // 기본이 아닌 모드(바-ㅇ탈출 노말모드 = ?mode=normal)도 따로 싣는다(2026-11-07) — 내용(FAQ · 인원 ·
  // 환불)이 달라 자기 주소를 대표로 알린다(themes/[slug]/page.tsx 의 canonical). 노말 행은 목록 카드에서
  // 빠지려고 is_listed 가 꺼져 있어 위 목록에 안 잡힌다.
  for (const t of themes.filter((t) => !t.is_locked && t.variant_group)) {
    const variants = await getThemeVariants(t.variant_group!);
    for (const v of variants.slice(1).filter((v) => !v.is_locked)) {
      routes.push({
        url: `${BASE_URL}${modeHref(t.slug, variants, v)}`,
        lastModified: new Date(v.updated_at),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  return routes;
}
