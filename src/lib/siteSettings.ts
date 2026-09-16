import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * 우하단 이벤트 말풍선 문구.
 *
 * 값은 **쿠폰 캠페인**에 붙어 있다(coupon_campaigns.show_event_bubble / event_bubble_text).
 * 말풍선이 가리키는 게 결국 그 쿠폰 이벤트라, 쿠폰을 켜고 끄는 자리에서 같이 관리한다
 * — 어드민 > 쿠폰 > 캠페인 편집(2026-09-16).
 *
 * 고객 화면은 캠페인 테이블을 직접 읽지 않는다(할인율·발급 조건까지 드러난다).
 * 공개해도 되는 문구만 추린 public_event_bubble 뷰만 읽는다(p42).
 */
export const EVENT_BUBBLE_TAG = "event-bubble";

async function _getEventBubbleText(): Promise<string> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("public_event_bubble").select("text").maybeSingle();
  // 읽기에 실패해도 화면은 그대로 떠야 한다 — 말풍선만 안 나온다.
  if (error || !data) return "";
  return typeof data.text === "string" ? data.text : "";
}

/**
 * 30초만 들고 있는다. 어드민에서 켜자마자 확인하고 싶은 값이라 오래 잡아두면
 * "안 켜지는데?" 가 된다. 캠페인을 저장할 때 태그로 한 번 털기도 한다.
 */
export const getEventBubbleText = unstable_cache(_getEventBubbleText, ["event-bubble-text"], {
  revalidate: 30,
  tags: [EVENT_BUBBLE_TAG],
});
