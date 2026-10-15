import "server-only";

/**
 * 인스타 해시태그 수집.
 *
 * ⚠️ `server-only` 다. 액세스 토큰이 여기 들어온다 — 클라이언트 번들로 내려가면
 *    토큰이 그대로 노출되고, 그 토큰으로 우리 계정을 읽을 수 있다.
 *
 * 왜 해시태그만 보는가
 *   공식 API 가 남의 게시물에 닿는 길은 해시태그 검색뿐이다. 본문에 "우주이스케이프"
 *   라고만 적고 해시태그를 안 단 글은 **이 길로는 못 찾는다.** 그런 글은 어드민에서
 *   주소를 붙여넣어 담는다.
 *
 * 통로가 둘이고 성격이 다르다
 *   top_media    — 시간 제한 없음. 알고리즘이 고른 인기 게시물이라 **쌓인 것**을 가져온다.
 *                  다만 전부를 주지는 않는다.
 *   recent_media — **쿼리 시점 기준 24시간 내 게시물만.** 그래서 하루 한 번은 돌려야
 *                  하고, 며칠 걸러 돌리면 그 사이 글은 이 통로로 영영 안 보인다.
 *   둘을 합쳐 쓰면 "쌓인 인기글 + 어제 새로 올라온 글" 이 된다.
 *
 * ⚠️ 작성자(username)를 주지 않는다. Meta 가 막아 둔 것이라 어느 통로로도 못 받는다.
 *    후기 카드에 작성자를 적으려면 어드민에서 손으로 넣어야 한다.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * 수집할 해시태그. **`#` 없이, 특수문자 없이** 적는다.
 *
 * ⚠️ 해시태그에는 하이픈이 들어가지 않는다 — "바-ㅇ탈출" 은 해시태그로 존재할 수
 *    없으므로 여기 적어도 검색되지 않는다.
 * ⚠️ 7일에 **고유 해시태그 30개** 까지만 조회할 수 있다. 일반적인 말(방탈출 등)을
 *    넣으면 한도만 쓰고 남의 글만 쏟아진다. 우리 고유어만 둔다.
 */
export const INSTAGRAM_HASHTAGS = ["우주이스케이프", "wouldyouescape"] as const;

export type InstagramMedia = {
  url: string;
  caption: string | null;
  postedAt: string | null;
};

type IgConfig = { token: string; userId: string };

function igConfig(): IgConfig | null {
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;
  if (!token || !userId) return null;
  return { token, userId };
}

/** 그래프 API 호출. 오류 메시지를 그대로 올려 보낸다 — 어디가 막혔는지 알아야 고친다. */
async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/**
 * 해시태그 문자열 → 해시태그 ID.
 *
 * 이 한 번의 조회가 **7일 30개 한도**를 깎는다. 같은 해시태그를 다시 조회하는 건
 * 한도를 추가로 쓰지 않지만(이미 센 것), 해시태그 수를 늘리면 그만큼 깎인다.
 */
async function hashtagId(cfg: IgConfig, tag: string): Promise<string | null> {
  const json = await graph<{ data?: { id: string }[] }>("ig_hashtag_search", {
    user_id: cfg.userId,
    q: tag,
    access_token: cfg.token,
  });
  return json.data?.[0]?.id ?? null;
}

async function mediaEdge(
  cfg: IgConfig,
  id: string,
  edge: "top_media" | "recent_media"
): Promise<InstagramMedia[]> {
  // username 은 요청할 수 없다 — 넣으면 요청 자체가 거부된다.
  const json = await graph<{
    data?: { permalink?: string; caption?: string; timestamp?: string }[];
  }>(`${id}/${edge}`, {
    user_id: cfg.userId,
    fields: "id,caption,media_type,permalink,timestamp",
    limit: "50",
    access_token: cfg.token,
  });

  return (json.data ?? [])
    .filter((m) => typeof m.permalink === "string" && m.permalink)
    .map((m) => ({
      url: m.permalink!,
      caption: m.caption ?? null,
      postedAt: m.timestamp ? m.timestamp.slice(0, 10) : null,
    }));
}

/**
 * 해시태그별로 인기글 + 최근글을 모아 온다.
 *
 * 한 해시태그가 막혀도 나머지는 계속한다 — 하나 때문에 수집 전체가 멈추면 안 된다.
 */
export async function collectInstagramMedia(): Promise<{
  items: InstagramMedia[];
  errors: string[];
}> {
  const cfg = igConfig();
  if (!cfg) {
    return { items: [], errors: ["토큰(IG_ACCESS_TOKEN / IG_USER_ID)이 설정되지 않았습니다."] };
  }

  const errors: string[] = [];
  const byUrl = new Map<string, InstagramMedia>();

  for (const tag of INSTAGRAM_HASHTAGS) {
    try {
      const id = await hashtagId(cfg, tag);
      if (!id) {
        errors.push(`#${tag}: 해시태그를 찾을 수 없습니다.`);
        continue;
      }
      for (const edge of ["top_media", "recent_media"] as const) {
        try {
          for (const m of await mediaEdge(cfg, id, edge)) {
            if (!byUrl.has(m.url)) byUrl.set(m.url, m);
          }
        } catch (err) {
          errors.push(`#${tag} ${edge}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(`#${tag}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { items: [...byUrl.values()], errors };
}
