import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicPromotion, PromotionPriceTier } from "@/lib/promotion";

/**
 * 켜져 있는 프로모션과 그 금액.
 *
 * 고객 화면은 promotions 표를 직접 읽지 않는다 — 꺼 둔 프로모션의 금액·기간이
 * 드러나면 아직 열지 않은 할인이 미리 공개된다. public_promotion 뷰만 읽는다.
 *
 * 켜진 프로모션은 DB 의 부분 유니크 인덱스(promotions_single_active)가
 * 한 번에 하나로 막는다. 그래서 여기서도 1건만 다룬다.
 */
export const PROMOTION_TAG = "promotion";

export type ActivePromotion = {
  promo: PublicPromotion;
  tiers: PromotionPriceTier[];
};

async function _getActivePromotion(): Promise<ActivePromotion | null> {
  const supabase = createPublicClient();

  // ⚠️ 읽기에 실패해도 화면은 그대로 떠야 한다. 프로모션만 안 보이고
  //    금액은 기본가로 돌아간다 — 신청 자체가 막히는 것보다 낫다.
  const { data: promo, error } = await supabase
    .from("public_promotion")
    .select("*")
    .maybeSingle();
  if (error || !promo) return null;

  const { data: tiers } = await supabase
    .from("public_promotion_price_tier")
    .select("*")
    .eq("promotion_id", (promo as PublicPromotion).id);

  return {
    promo: promo as PublicPromotion,
    tiers: (tiers ?? []) as PromotionPriceTier[],
  };
}

/**
 * 60초만 들고 있는다. 어드민에서 켜자마자 확인하고 싶은 값이라 오래 잡아두면
 * "안 켜지는데?" 가 된다. 저장할 때 태그로 한 번 털기도 한다.
 *
 * ⚠️ 적용 **기간**이 캐시 안에 들어 있다. 끝나는 순간 바로 꺼지지 않고 최대
 *    60초 늦게 꺼진다는 뜻이다. 화면 표시가 늦는 것일 뿐, 실제 금액은
 *    신청 순간에 DB 가 다시 판정하므로 할인이 새어 나가지는 않는다.
 */
export const getActivePromotion = unstable_cache(_getActivePromotion, ["active-promotion"], {
  revalidate: 60,
  tags: [PROMOTION_TAG],
});

/** 한 테마에 적용되는 금액 구간만 추린다. 없으면 그 테마는 프로모션 대상이 아니다. */
export function promotionTiersForTheme(
  active: ActivePromotion | null,
  themeId: string
): PromotionPriceTier[] {
  if (!active) return [];
  return active.tiers.filter((t) => t.theme_id === themeId);
}
