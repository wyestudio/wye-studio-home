import "server-only";

/**
 * 후기 후보를 찾아오는 쪽. 크론(`/api/cron/collect-reviews`)과 어드민이 쓴다.
 *
 * ⚠️ `server-only` 다. 네이버 검색 키가 여기 들어오므로 클라이언트 번들로 내려가면
 *    키가 그대로 노출된다. 잘못 import 하면 빌드가 깨져서 알려 준다.
 *
 * 채널이 둘인데 가져오는 방식이 다르다:
 *   naver     — 공식 검색 API 로 **우리가 찾아온다**(크론, 하루 1회).
 *   instagram — 인스타가 자동 수집을 막아 둬서 찾아올 수 없다. 해시태그 페이지를
 *               받아 봐도 게시물 데이터가 한 건도 들어 있지 않다(전부 JS 번들).
 *               그래서 **사람이 주소를 붙여넣고**, 화면은 공식 임베드로 그린다.
 */

/** 검색할 말. 늘리면 그만큼 크론이 API 를 더 부른다(HUB 무료 한도가 월 77만 건이라 여유는 많다). */
export const REVIEW_SEARCH_KEYWORDS = ["우주이스케이프", "바-ㅇ탈출"] as const;

/** 한 번에 받아올 검색 결과 수. 네이버 최대 100. */
const NAVER_DISPLAY = 50;

export type NaverSearchItem = {
  url: string;
  title: string;
  excerpt: string;
  author: string;
  postedAt: string | null;
};

/**
 * 네이버 검색 키 (NAVER API HUB).
 *
 * ⚠️ **개발자센터(openapi.naver.com) 방식이 아니다.** 네이버가 검색 API 를 네이버
 *    클라우드의 NAVER API HUB 로 옮겼고, 2026-07-31 부터 개발자센터에서는 검색 API
 *    를 **신규 등록할 수 없다**(기존 앱에 추가하려 하면 "신규로 등록할 수 없는 API"
 *    라고 막힌다). 그래서 로그인용 `NAVER_CLIENT_ID` 로는 검색을 부를 수 없고,
 *    키를 섞어 쓰지 않도록 폴백도 두지 않는다.
 *
 * 키는 네이버 클라우드 콘솔 > Services > Application Service > NAVER API HUB 에서
 * 애플리케이션을 만들면 나오는 Client ID / Client Secret 이다.
 * (2026-07-30 이전부터 쓰던 곳은 옛 방식이 2027-06-30 까지 한시 허용되지만,
 *  우리는 새로 붙이는 쪽이라 처음부터 HUB 로 간다.)
 */
function naverKeys(): { id: string; secret: string } | null {
  const id = process.env.NAVER_SEARCH_API_KEY_ID;
  const secret = process.env.NAVER_SEARCH_API_KEY;
  if (!id || !secret) return null;
  return { id, secret };
}

/** 검색 결과의 `<b>` 강조와 HTML 엔티티를 벗긴다. 그대로 쓰면 화면에 태그가 보인다. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** '20260829' → '2026-08-29'. 비거나 형식이 다르면 null. */
function parsePostdate(s: string | undefined): string | null {
  if (!s || !/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * 네이버 블로그 주소를 **모바일 주소로** 바꾼다.
 *
 * ⚠️ PC 주소(`blog.naver.com/...`)는 본문을 iframe 으로 싣는 껍데기라 og 태그가
 *    하나도 없다(2.7KB). `m.blog.naver.com` 으로 바꿔야 제목·요약·썸네일이 나온다.
 *    이걸 모르면 썸네일이 통째로 비는 채로 수집된다.
 */
export function toNaverMobileUrl(url: string): string {
  return url.replace(/^https?:\/\/blog\.naver\.com\//, "https://m.blog.naver.com/");
}

/** 네이버 블로그 검색. 키가 없거나 호출이 막히면 빈 배열 대신 오류를 돌려준다. */
export async function searchNaverBlogs(
  keyword: string
): Promise<{ items: NaverSearchItem[] } | { error: string }> {
  const keys = naverKeys();
  if (!keys) {
    return { error: "네이버 검색 키(NAVER_SEARCH_API_KEY_ID / NAVER_SEARCH_API_KEY)가 없습니다." };
  }

  const url =
    `https://naverapihub.apigw.ntruss.com/search/v1/blog` +
    `?query=${encodeURIComponent(keyword)}&display=${NAVER_DISPLAY}&sort=date&format=json`;

  const res = await fetch(url, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": keys.id,
      "X-NCP-APIGW-API-KEY": keys.secret,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // 응답 원문을 그대로 보여 준다 — 키가 틀린 건지, 애플리케이션에 검색 API 를
    // 안 붙인 건지, 한도를 넘은 건지가 메시지로만 구분된다.
    return { error: `네이버 검색 실패 (HTTP ${res.status}): ${body.slice(0, 200)}` };
  }

  const json = (await res.json()) as {
    items?: { title?: string; link?: string; description?: string; bloggername?: string; postdate?: string }[];
  };

  const items: NaverSearchItem[] = (json.items ?? [])
    .filter((it) => typeof it.link === "string" && it.link.length > 0)
    .map((it) => ({
      url: toNaverMobileUrl(it.link!),
      title: stripHtml(it.title ?? ""),
      excerpt: stripHtml(it.description ?? ""),
      author: stripHtml(it.bloggername ?? ""),
      postedAt: parsePostdate(it.postdate),
    }));

  return { items };
}

export type OgTags = { title?: string; description?: string; image?: string };

/**
 * 게시물에서 og 태그를 뽑는다. 썸네일은 검색 API 가 주지 않아 여기서만 얻는다.
 *
 * 실패해도 던지지 않는다 — 한 건이 막혀서 수집 전체가 멈추면 안 된다.
 */
export async function fetchOgTags(rawUrl: string): Promise<OgTags> {
  const url = toNaverMobileUrl(rawUrl);
  try {
    const res = await fetch(url, {
      headers: {
        // 봇 차단에 걸리면 빈 셸이 온다. 일반 브라우저로 보이게 한다.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return {};
    const html = await res.text();

    const pick = (prop: string): string | undefined => {
      // content 가 property 앞에 오는 경우도 있어 양쪽을 본다.
      const a = html.match(
        new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)`, "i")
      );
      const b = html.match(
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${prop}["']`, "i")
      );
      const raw = a?.[1] ?? b?.[1];
      return raw ? stripHtml(raw) : undefined;
    };

    return { title: pick("og:title"), description: pick("og:description"), image: pick("og:image") };
  } catch {
    return {};
  }
}

/** 인스타 게시물·릴스 주소인가. 붙여넣기 칸에서 주소를 거를 때 쓴다. */
export function isInstagramPostUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/.test(url.trim());
}

/**
 * 주소에서 추적 파라미터(`?igsh=`, `?utm_*`)를 떼어 낸다.
 *
 * ⚠️ 이걸 안 하면 **같은 게시물이 다른 주소로 들어와** url 의 unique 를 지나쳐 버린다.
 *    그러면 "관련없음" 으로 치운 글이 다음날 또 뜬다.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.search = "";
    // 인스타 게시물 주소는 끝의 / 유무가 갈리므로 하나로 맞춘다.
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return trimmed;
  }
}
