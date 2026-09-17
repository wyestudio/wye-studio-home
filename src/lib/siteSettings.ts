import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * 우하단 이벤트 말풍선 문구와, 말풍선이 켜진 동안 인스타 버튼이 향할 주소.
 *
 * 값은 **쿠폰 캠페인**에 붙어 있다(coupon_campaigns.show_event_bubble / event_bubble_text /
 * event_bubble_url). 말풍선이 가리키는 게 결국 그 쿠폰 이벤트라, 쿠폰을 켜고 끄는 자리에서
 * 같이 관리한다 — 어드민 > 쿠폰 > 캠페인 편집(2026-09-16, 주소는 2026-09-17).
 *
 * 고객 화면은 캠페인 테이블을 직접 읽지 않는다(할인율·발급 조건까지 드러난다).
 * 공개해도 되는 값만 추린 public_event_bubble 뷰만 읽는다(p42).
 */
export const EVENT_BUBBLE_TAG = "event-bubble";

export type EventBubble = { text: string; url: string | null };

async function _getEventBubble(): Promise<EventBubble> {
  const supabase = createPublicClient();
  // select * 인 이유: url 칸이 아직 없는 DB 에서도 문구는 그대로 읽혀야 한다.
  const { data, error } = await supabase.from("public_event_bubble").select("*").maybeSingle();
  // 읽기에 실패해도 화면은 그대로 떠야 한다 — 말풍선만 안 나온다.
  if (error || !data) return { text: "", url: null };
  const row = data as { text?: unknown; url?: unknown };
  return {
    text: typeof row.text === "string" ? row.text : "",
    url: typeof row.url === "string" && row.url.startsWith("https://") ? row.url : null,
  };
}

/**
 * 30초만 들고 있는다. 어드민에서 켜자마자 확인하고 싶은 값이라 오래 잡아두면
 * "안 켜지는데?" 가 된다. 캠페인을 저장할 때 태그로 한 번 털기도 한다.
 */
export const getEventBubble = unstable_cache(_getEventBubble, ["event-bubble"], {
  revalidate: 30,
  tags: [EVENT_BUBBLE_TAG],
});
