import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * 사이트 전역 설정(site_settings). 어드민에서 고치면 배포 없이 화면이 바뀐다.
 *
 * ⚠️ 고객 화면에서 읽는 설정은 **key 를 'public.' 으로 시작**해야 한다(p41).
 *    그 접두사가 붙은 행만 anon 이 읽을 수 있게 막아 뒀다.
 */
export const SITE_SETTINGS_TAG = "site-settings";

export const EVENT_BUBBLE_KEY = "public.event_bubble";

/** 우하단 인스타 버튼 위 말풍선. */
export type EventBubbleSetting = {
  enabled: boolean;
  /** 줄바꿈을 그대로 보여준다. 두 줄까지가 읽기 좋다. */
  text: string;
};

export const EVENT_BUBBLE_FALLBACK: EventBubbleSetting = { enabled: false, text: "" };

async function _getEventBubble(): Promise<EventBubbleSetting> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", EVENT_BUBBLE_KEY)
    .maybeSingle();

  // 설정 행이 없거나 읽기에 실패해도 화면은 그대로 떠야 한다 — 말풍선만 안 나온다.
  if (error || !data) return EVENT_BUBBLE_FALLBACK;
  const value = data.value as Partial<EventBubbleSetting> | null;
  return {
    enabled: value?.enabled === true,
    text: typeof value?.text === "string" ? value.text : "",
  };
}

/**
 * 30초만 들고 있는다. 어드민에서 켜자마자 확인하고 싶은 값이라 오래 잡아두면
 * "안 켜지는데?" 가 된다. 저장할 때 태그로 한 번 털기도 한다(admin/content/actions.ts).
 */
export const getEventBubble = unstable_cache(_getEventBubble, ["event-bubble"], {
  revalidate: 30,
  tags: [SITE_SETTINGS_TAG],
});
