import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { isSiteSkin, type SiteSkin } from "@/lib/season";

/**
 * 지금 씌운 시즌 스킨. 없으면 null.
 *
 * 고객 화면은 site_settings 를 직접 못 읽는다(다른 설정까지 드러난다). 스킨 이름
 * 하나만 내보내는 public_site_season 뷰를 읽는다(20261021074221).
 */
export const SITE_SEASON_TAG = "site-season";

async function _getSiteSkin(): Promise<SiteSkin | null> {
  // 로컬 개발 서버에서만 — 공용 DB 값을 바꾸지 않고 스킨을 미리 본다(SEASON_SKIN_PREVIEW=christmas npm run dev).
  // 운영 빌드에서는 읽지 않는다.
  const preview = process.env.SEASON_SKIN_PREVIEW;
  if (process.env.NODE_ENV === "development" && preview !== undefined) {
    return isSiteSkin(preview) ? preview : null;
  }
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("public_site_season").select("skin").maybeSingle();
  // 읽기에 실패해도 화면은 떠야 한다 — 스킨만 안 씌운다(뷰가 아직 없는 DB 포함).
  if (error || !data) return null;
  const skin = (data as { skin?: unknown }).skin;
  return isSiteSkin(skin) ? skin : null;
}

/** 30초. 어드민에서 켠 직후 확인하는 값이다. 켜고 끌 때 태그로 한 번 털기도 한다. */
export const getSiteSkin = unstable_cache(_getSiteSkin, ["site-season"], {
  revalidate: 30,
  tags: [SITE_SEASON_TAG],
});
