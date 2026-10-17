import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 우리 인스타 계정(@wouldyouescape)의 게시물 목록.
 *
 * 홈의 인스타 섹션이 쓴다. 남의 후기를 모으는 `instagramSource.ts`(해시태그 검색,
 * 페이스북 로그인 토큰)와는 **통로가 다르다** — 여기는 "인스타 로그인" 방식의
 * 토큰으로 우리 계정 글만 읽는다. 페이스북 페이지 연결이 필요 없다.
 *
 * ⚠️ `server-only`. 토큰이 여기 들어온다.
 *
 * 토큰 수명
 *   60일이면 만료된다. 만료 전(발급 24시간 뒤부터) 갱신하면 다시 60일짜리가 나온다.
 *   매일 도는 후기 수집 크론이 `refreshOwnInstagramToken` 을 불러 일주일에 한 번
 *   갱신하고 새 토큰을 `instagram_tokens` 표에 적는다. 처음 한 번만 환경변수
 *   `IG_OWN_ACCESS_TOKEN` 으로 넣으면 그 뒤로는 표가 우선한다.
 *   ⚠️ 크론이 60일 넘게 멈추면 토큰이 죽는다 — 그때는 새로 발급해 환경변수에 넣고
 *      표의 줄을 지워야 한다(표가 우선이라 죽은 토큰을 계속 쓴다).
 */

const API = "https://graph.instagram.com";
/**
 * 홈에 보일 게시물 수. 임베드 하나하나가 iframe 이라 다 띄우면 홈이 무거워진다.
 * 그 뒤로는 홈 섹션의 마지막 카드("인스타에서 더 보기")가 계정으로 보낸다.
 */
export const OWN_POST_LIMIT = 6;
/** 이 주기보다 오래된 토큰만 갱신한다. 60일 만료에 넉넉히 앞선다. */
const REFRESH_EVERY_DAYS = 7;

export const OWN_INSTAGRAM_TAG = "own-instagram";

type TokenRow = { access_token: string; expires_at: string | null; refreshed_at: string };

async function loadToken(): Promise<{ token: string; row: TokenRow | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("instagram_tokens")
    .select("access_token, expires_at, refreshed_at")
    .eq("id", "own")
    .maybeSingle<TokenRow>();
  if (data?.access_token) return { token: data.access_token, row: data };
  const env = process.env.IG_OWN_ACCESS_TOKEN?.trim();
  return env ? { token: env, row: null } : null;
}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

/** 최신 게시물 주소. 인스타가 최신순으로 준다. 토큰이 없으면 null. */
async function fetchOwnPostUrls(): Promise<string[] | null> {
  const t = await loadToken();
  if (!t) return null;
  const json = await api<{ data?: { permalink?: string }[] }>("me/media", {
    fields: "permalink,timestamp,media_type",
    limit: String(OWN_POST_LIMIT),
    access_token: t.token,
  });
  return (json.data ?? []).map((m) => m.permalink).filter((u): u is string => !!u);
}

/**
 * 홈에 보일 우리 게시물. 한 시간 캐시한다 — 홈은 방문마다 그려지는데 매번 인스타를
 * 부르면 느리고 호출 한도도 깎인다.
 *
 * 실패하면 null 을 돌려준다(캐시하지 않는다). 홈은 그때 코드에 적어 둔 목록을 쓴다 —
 * 토큰 문제로 홈 섹션이 통째로 비면 안 된다.
 */
export const getOwnInstagramPosts = unstable_cache(
  async (): Promise<string[] | null> => {
    const urls = await fetchOwnPostUrls();
    // null(토큰 없음)·빈 목록은 캐시에 남기지 않으려고 던진다. 아래에서 null 로 바꾼다.
    if (!urls || urls.length === 0) throw new Error("no-own-instagram");
    return urls;
  },
  ["own-instagram-posts"],
  { revalidate: 3600, tags: [OWN_INSTAGRAM_TAG] }
);

export async function getOwnInstagramPostsSafe(): Promise<string[] | null> {
  try {
    return await getOwnInstagramPosts();
  } catch (err) {
    if (!(err instanceof Error && err.message === "no-own-instagram")) {
      console.error("[instagramOwn] 게시물을 못 가져와 기본 목록을 씁니다:", err);
    }
    return null;
  }
}

/**
 * 토큰 갱신. 크론이 매일 부르고, 마지막 갱신이 일주일 넘었을 때만 실제로 갱신한다.
 * 토큰이 아직 없으면 할 일이 없으므로 조용히 넘어간다(설정 전 상태).
 */
export async function refreshOwnInstagramToken(): Promise<{ refreshed: boolean; error?: string }> {
  try {
    const t = await loadToken();
    if (!t) return { refreshed: false };

    // 처음(표에 줄이 없고 환경변수 토큰만 있을 때)은 갱신하지 않고 표에 옮겨 적기만 한다.
    // ⚠️ 발급 24시간이 안 된 토큰은 갱신이 거부된다. 환경변수 토큰은 언제 발급됐는지
    //    알 수 없으니, 지금을 기준 시각으로 적어 두고 일주일 뒤에 갱신한다(60일 만료에 넉넉하다).
    if (!t.row) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("instagram_tokens")
        .upsert({ id: "own", access_token: t.token, refreshed_at: new Date().toISOString() });
      return error ? { refreshed: false, error: error.message } : { refreshed: false };
    }

    const last = new Date(t.row.refreshed_at).getTime();
    if (Date.now() - last < REFRESH_EVERY_DAYS * 86400_000) return { refreshed: false };

    const json = await api<{ access_token?: string; expires_in?: number }>("refresh_access_token", {
      grant_type: "ig_refresh_token",
      access_token: t.token,
    });
    if (!json.access_token) return { refreshed: false, error: "갱신 응답에 토큰이 없습니다." };

    const supabase = createAdminClient();
    const { error } = await supabase.from("instagram_tokens").upsert({
      id: "own",
      access_token: json.access_token,
      expires_at: json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : null,
      refreshed_at: new Date().toISOString(),
    });
    if (error) return { refreshed: false, error: error.message };
    return { refreshed: true };
  } catch (err) {
    return { refreshed: false, error: err instanceof Error ? err.message : String(err) };
  }
}
