import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectInstagramMedia } from "@/lib/instagramSource";
import { sendReviewCollectFailureAlert } from "@/lib/slack";
import { updateRatingStats } from "@/lib/updateRatingStats";
import {
  REVIEW_SEARCH_KEYWORDS,
  fetchOgTags,
  normalizeUrl,
  searchNaverBlogs,
} from "@/lib/reviewSources";

export const dynamic = "force-dynamic";
// og 태그를 여러 건 받아오므로 기본 10초로는 모자란다.
export const maxDuration = 60;

/**
 * 후기 후보 수집 (하루 1회).
 *
 * 등록하는 곳은 기존 크론과 같다 — GitHub Actions(`supabase-keepalive.yml`) 또는
 * cron-job.org. `vercel.json` 은 쓰지 않는다(이 저장소에 없고, Hobby 플랜은 횟수가 빠듯하다).
 *
 * 하는 일은 **찾아서 쌓아 두는 것까지**다. 사이트에 싣는 결정은 /admin/reviews 에서
 * 사람이 한다 — 검색 결과에는 우리와 무관한 글이 반드시 섞인다.
 *
 * ⚠️ 이미 본 주소는 건드리지 않는다. 특히 "관련없음(ignored)" 으로 치운 글을 다시
 *    넣으면 매일 같은 글을 치우게 되어 이 기능을 쓸 수 없다. url 의 unique 와
 *    아래 "이미 있는 것 빼기" 두 겹으로 막는다.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const token =
    request.nextUrl.searchParams.get("token") || request.headers.get("x-cron-secret");
  if (!token || token !== expected) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const errors: string[] = [];

  type Found = {
    channel: "naver" | "instagram";
    title: string | null;
    excerpt: string | null;
    author: string | null;
    postedAt: string | null;
  };
  const found = new Map<string, Found>();

  // 1) 네이버 블로그 — 공식 검색 API 로 키워드 검색.
  for (const keyword of REVIEW_SEARCH_KEYWORDS) {
    const res = await searchNaverBlogs(keyword);
    if ("error" in res) {
      errors.push(`네이버 "${keyword}": ${res.error}`);
      continue;
    }
    for (const item of res.items) {
      const url = normalizeUrl(item.url);
      // 키워드 둘 다에 걸리는 글이 있다. 먼저 담긴 것을 둔다.
      if (!found.has(url)) {
        found.set(url, {
          channel: "naver",
          title: item.title || null,
          excerpt: item.excerpt || null,
          author: item.author || null,
          postedAt: item.postedAt,
        });
      }
    }
  }

  // 2) 인스타 — 해시태그 검색. 토큰이 없으면 errors 에만 남고 네이버 수집은 그대로 간다.
  const ig = await collectInstagramMedia();
  errors.push(...ig.errors.map((e) => `인스타 ${e}`));
  for (const m of ig.items) {
    const url = normalizeUrl(m.url);
    if (!found.has(url)) {
      found.set(url, {
        channel: "instagram",
        title: null,
        // 캡션 첫 줄이 있으면 목록에서 어떤 글인지 알아보기 쉽다. 카드 자체는
        // 임베드가 원본을 그리므로 이 값은 어드민에서만 쓰인다.
        excerpt: m.caption ? m.caption.replace(/\s+/g, " ").slice(0, 300) : null,
        author: null,
        postedAt: m.postedAt,
      });
    }
  }

  // 평점 갱신은 수집과 독립이다 — 새 글이 하나도 없어도 설문 응답은 늘어난다.
  // 캐시 태그는 여기서 털지 않는다(서버 액션이 아니라 라우트다). 공개 화면은
  // themes 를 5분 캐시하므로 늦어도 5분 뒤 반영된다.
  const rating = await updateRatingStats(supabase);
  errors.push(...rating.errors.map((e) => `평점 ${e}`));

  if (found.size === 0) {
    if (errors.length > 0) {
      await sendReviewCollectFailureAlert({ errors, inserted: 0 });
      // ⚠️ 200 으로 돌려주면 안 된다. curl 은 본문을 보지 않고 종료코드 0 을 내므로
      //    등록한 크론이 **실패를 성공으로 찍는다** (keepalive 잡이 같은 함정에
      //    빠져 한 번도 동작하지 않은 적이 있다). 한 군데도 못 찾았으면 실패다.
      return NextResponse.json(
        { ok: false, found: 0, inserted: 0, rating: rating.summary, errors },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, found: 0, inserted: 0, rating: rating.summary, errors });
  }

  // 이미 담은 주소는 뺀다 — status 와 상관없이 전부. ignored 도 여기서 걸러진다.
  const urls = [...found.keys()];
  const { data: existing, error: selErr } = await supabase
    .from("review_candidates")
    .select("url")
    .in("url", urls);

  if (selErr) {
    return NextResponse.json({ error: "기존 후보 조회 실패", details: selErr.message }, { status: 500 });
  }

  const known = new Set((existing ?? []).map((r) => r.url as string));
  const fresh = urls.filter((u) => !known.has(u));

  const rows: Record<string, unknown>[] = [];

  // 인스타는 og 를 받지 않는다 — 임베드가 원본을 그리므로 썸네일이 필요 없고,
  // 로그인 벽 때문에 받아 봐야 빈 껍데기만 온다.
  for (const url of fresh) {
    const base = found.get(url)!;
    if (base.channel !== "instagram") continue;
    rows.push({
      channel: "instagram",
      url,
      excerpt: base.excerpt,
      posted_at: base.postedAt,
      status: "new",
    });
  }

  // 네이버는 새 것만 og 를 받는다(썸네일은 검색 API 가 주지 않는다).
  // 한꺼번에 몰지 않도록 조금씩 끊어서 부른다.
  const naverFresh = fresh.filter((u) => found.get(u)!.channel === "naver");
  const CHUNK = 5;
  for (let i = 0; i < naverFresh.length; i += CHUNK) {
    const slice = naverFresh.slice(i, i + CHUNK);
    const ogs = await Promise.all(slice.map((u) => fetchOgTags(u)));
    slice.forEach((url, idx) => {
      const base = found.get(url)!;
      const og = ogs[idx];
      rows.push({
        channel: "naver",
        url,
        // og 쪽이 잘리지 않은 원문이라 있으면 그쪽을 쓴다.
        title: og.title || base.title || null,
        excerpt: og.description || base.excerpt || null,
        author: base.author || null,
        posted_at: base.postedAt,
        thumbnail_url: og.image || null,
        status: "new",
      });
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    // 경쟁 상황(같은 순간 두 번 실행)에도 중복이 생기지 않게 url 충돌은 무시한다.
    const { data, error } = await supabase
      .from("review_candidates")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
      .select("id");
    if (error) {
      return NextResponse.json({ error: "후보 저장 실패", details: error.message }, { status: 500 });
    }
    inserted = data?.length ?? 0;
  }

  // 일부만 실패한 경우(예: 네이버는 되는데 인스타 토큰이 죽음)도 알린다.
  // 수집은 됐으니 200 이지만, 조용히 두면 한쪽이 죽은 걸 영영 모른다.
  if (errors.length > 0) {
    await sendReviewCollectFailureAlert({ errors, inserted });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    found: found.size,
    skipped_already_known: known.size,
    inserted,
    rating: rating.summary,
    rating_updated: rating.updated,
    errors,
  });
}
