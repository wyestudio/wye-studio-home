import "server-only";
import { getListedThemes, getThemeVariants } from "@/lib/themes";
import { modeHref } from "@/app/(site)/themes/[slug]/ModeBox";

/**
 * 검색엔진에 알릴 테마 상세 주소들 — 사이트맵(sitemap.ts)과 IndexNow(indexNow.ts)가 같이 쓴다.
 *
 * 잠긴 테마는 뺀다(아직 안 연 것을 검색 결과로 먼저 만나면 "들어갔더니 자물쇠" 가 된다).
 * 기본이 아닌 모드(노말모드 = ?mode=normal)도 따로 싣는다 — 내용(FAQ · 인원 · 환불)이 달라
 * 자기 주소를 대표로 알린다(themes/[slug]/page.tsx 의 canonical). 노말 행은 목록 카드에서
 * 빠지려고 is_listed 가 꺼져 있어 getListedThemes() 에 안 잡힌다.
 */
export async function publicThemePaths(): Promise<{ path: string; updatedAt: string; isMode: boolean }[]> {
  const themes = (await getListedThemes()).filter((t) => !t.is_locked);
  const out = themes.map((t) => ({ path: `/themes/${t.slug}`, updatedAt: t.updated_at, isMode: false }));
  for (const t of themes.filter((t) => t.variant_group)) {
    const variants = await getThemeVariants(t.variant_group!);
    for (const v of variants.slice(1).filter((v) => !v.is_locked)) {
      out.push({ path: modeHref(t.slug, variants, v), updatedAt: v.updated_at, isMode: true });
    }
  }
  return out;
}
