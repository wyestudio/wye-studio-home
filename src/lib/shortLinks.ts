import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { SHORT_LINKS_TAG, utmPath, type UtmLink } from "@/lib/utmLinks";

type ShortLinkRow = Pick<
  UtmLink,
  "slug" | "landing_path" | "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term"
>;

/**
 * 어드민에서 만든 짧은 주소 목록.
 *
 * ⚠️ 한 건씩 찾지 않고 통째로 받아 캐시한다. 최상위 경로 중 실제 페이지가 없는
 *    주소는 전부 이 해석기로 들어오는데(봇이 긁는 /wp-login.php 같은 것 포함),
 *    그때마다 DB 를 때리면 없는 주소가 DB 부하가 된다.
 *
 * ⚠️ service_role 을 쓰지 않는다. 공개 뷰(public_short_link)가 살아 있는 행의
 *    목적지만 내보내므로 공개 키로 충분하다 — 메모·라벨은 새지 않는다.
 *
 * 어드민에서 저장하면 SHORT_LINKS_TAG 를 털어 바로 반영된다.
 */
export const getShortLinks = unstable_cache(
  async (): Promise<ShortLinkRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("public_short_link")
      .select("slug, landing_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term");

    // 실패를 빈 목록으로 삼키면 살아 있던 짧은 주소가 조용히 404 가 된다.
    // 밖에서 잡아 처리할 수 있게 던진다.
    if (error) throw error;
    return (data ?? []) as ShortLinkRow[];
  },
  ["short-links"],
  { revalidate: 300, tags: [SHORT_LINKS_TAG] }
);

/** 짧은 주소 하나의 목적지 경로. 없으면 null. */
export async function resolveShortLink(slug: string): Promise<string | null> {
  const links = await getShortLinks();
  const hit = links.find((l) => l.slug === slug);
  return hit ? utmPath(hit) : null;
}
