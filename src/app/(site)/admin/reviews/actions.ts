"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { THEMES_TAG } from "@/lib/themes";
import {
  fetchOgTags,
  isInstagramPostUrl,
  normalizeUrl,
  toNaverMobileUrl,
} from "@/lib/reviewSources";

const BUCKET = "theme-assets";

type Candidate = {
  id: string;
  channel: "naver" | "instagram";
  url: string;
  title: string | null;
  excerpt: string | null;
  author: string | null;
  posted_at: string | null;
  thumbnail_url: string | null;
  stored_thumbnail_url: string | null;
  status: string;
  published_theme_slug: string | null;
};

/**
 * 네이버 썸네일을 우리 저장소로 옮긴다.
 *
 * ⚠️ `blogthumb.pstatic.net` 주소는 만료된다. 그대로 박아 두면 몇 달 뒤 후기 카드의
 *    그림만 깨진 채로 남는다 — 화면에서는 멀쩡해 보이다가 어느 날 조용히 깨진다.
 *    그래서 **게재를 고른 순간** 받아서 우리 버킷에 올리고 그 주소를 쓴다.
 *
 * 실패하면 null 을 돌려주고 원본 주소를 그대로 쓴다. 그림 하나 때문에 게재 자체가
 * 막히면 안 된다.
 */
async function storeThumbnail(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  imageUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;

    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;

    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 5 * 1024 * 1024) return null;

    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    // 이름을 재사용하지 않는다 — 같은 이름을 덮으면 옛 그림이 구글 이미지에 남는다.
    const key = `reviews/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: type, upsert: false });
    if (error) return null;

    return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  } catch {
    return null;
  }
}

/** 관련없음으로 치운다. url 이 unique 라 크론이 같은 글을 다시 넣지 못한다. */
export async function ignoreCandidate(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("review_candidates")
      .update({ status: "ignored", decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };

    await writeAuditLog({
      action: "review_candidate.ignored",
      targetType: "review_candidate",
      targetId: id,
      summary: "후기 후보를 관련없음으로 치움",
    });

    revalidatePath("/admin/reviews");
    return { success: true, message: "관련없음으로 치웠습니다. 다시 뜨지 않습니다." };
  } catch (err) {
    return toActionError(err, "처리에 실패했습니다.");
  }
}

/** 판단을 되돌린다(다시 '안 본 것'으로). 잘못 누른 걸 되살리는 길이 없으면 안 된다. */
export async function resetCandidate(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("review_candidates")
      .update({ status: "new", decided_at: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/reviews");
    return { success: true, message: "되돌렸습니다." };
  } catch (err) {
    return toActionError(err, "처리에 실패했습니다.");
  }
}

/**
 * 후보를 테마의 후기 블록에 싣는다.
 *
 * 블록 구조는 `ThemeBlock`(src/types/catalog.ts)의 reviews 를 따른다:
 *   instagram — 주소만 넣는다. 공식 임베드가 원본을 그대로 그린다.
 *   naver     — 임베드 수단이 없어 제목·요약·썸네일·작성자로 **우리 카드**를 만든다.
 */
export async function publishCandidate(input: {
  id: string;
  themeSlug: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    const { data: cand, error: candErr } = await supabase
      .from("review_candidates")
      .select("*")
      .eq("id", input.id)
      .single<Candidate>();
    if (candErr || !cand) return { error: "후보를 찾을 수 없습니다." };

    const { data: theme, error: themeErr } = await supabase
      .from("themes")
      .select("id, slug, content")
      .eq("slug", input.themeSlug)
      .single<{ id: string; slug: string; content: { blocks?: unknown[] } | null }>();
    if (themeErr || !theme) return { error: "테마를 찾을 수 없습니다." };

    const content = (theme.content ?? {}) as { blocks?: Record<string, unknown>[] };
    const blocks = Array.isArray(content.blocks) ? [...content.blocks] : [];
    const idx = blocks.findIndex((b) => b?.type === "reviews");
    if (idx === -1) {
      return {
        error: "이 테마에 후기 블록이 없습니다. 테마 편집에서 '후기' 블록을 먼저 추가해주세요.",
      };
    }

    // 썸네일은 네이버 카드에만 필요하다. 인스타는 임베드가 알아서 그린다.
    let image = cand.stored_thumbnail_url;
    if (cand.channel === "naver" && !image && cand.thumbnail_url) {
      image = await storeThumbnail(supabase, cand.thumbnail_url);
      if (image) {
        await supabase
          .from("review_candidates")
          .update({ stored_thumbnail_url: image })
          .eq("id", cand.id);
      }
    }

    const block = blocks[idx] as Record<string, unknown>;
    const links = Array.isArray(block.links) ? [...(block.links as Record<string, unknown>[])] : [];

    // 같은 주소가 이미 실려 있으면 또 넣지 않는다.
    const already = links.some((l) => normalizeUrl(String(l?.url ?? "")) === normalizeUrl(cand.url));
    if (!already) {
      links.push(
        cand.channel === "instagram"
          ? { channel: "instagram", url: cand.url }
          : {
              channel: "naver",
              url: cand.url,
              author: cand.author || undefined,
              title: cand.title || undefined,
              excerpt: cand.excerpt || undefined,
              image: image || cand.thumbnail_url || undefined,
              date: cand.posted_at ? cand.posted_at.replace(/-/g, ".") : undefined,
            }
      );
    }

    blocks[idx] = { ...block, links };

    const { error: upErr } = await supabase
      .from("themes")
      .update({ content: { ...content, blocks } })
      .eq("id", theme.id);
    if (upErr) return { error: upErr.message };

    const { error: stErr } = await supabase
      .from("review_candidates")
      .update({
        status: "published",
        published_theme_slug: theme.slug,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cand.id);
    if (stErr) return { error: stErr.message };

    await writeAuditLog({
      action: "review_candidate.published",
      targetType: "review_candidate",
      targetId: cand.id,
      summary: `후기 게재 (${theme.slug}) ${cand.title ?? cand.url}`,
    });

    revalidatePath("/admin/reviews");
    // 공개 화면은 테마를 5분 캐시한다. 털지 않으면 올린 후기가 바로 안 보인다.
    updateTag(THEMES_TAG);

    return {
      success: true,
      message: already ? "이미 실려 있어 상태만 바꿨습니다." : "후기 블록에 실었습니다.",
    };
  } catch (err) {
    return toActionError(err, "게재에 실패했습니다.");
  }
}

/**
 * 인스타 주소 일괄 등록.
 *
 * 인스타는 자동으로 찾아올 수 없다(해시태그 페이지에 게시물 데이터가 없다).
 * 대신 **주소를 줄바꿈으로 여러 개 붙여넣으면** 한 번에 후보로 담는다.
 * 쌓여 있던 릴스·게시물을 정리할 때 이 길로 들어온다.
 */
export async function addInstagramUrls(raw: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    const urls = [...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(normalizeUrl)
    )];

    if (urls.length === 0) return { error: "주소를 한 줄에 하나씩 붙여넣어주세요." };

    const valid = urls.filter(isInstagramPostUrl);
    const invalid = urls.filter((u) => !isInstagramPostUrl(u));
    if (valid.length === 0) {
      return { error: "인스타 게시물·릴스 주소가 없습니다. (instagram.com/p/… 또는 /reel/…)" };
    }

    const { data, error } = await supabase
      .from("review_candidates")
      .upsert(
        valid.map((url) => ({ channel: "instagram", url, status: "new" })),
        { onConflict: "url", ignoreDuplicates: true }
      )
      .select("id");
    if (error) return { error: error.message };

    const added = data?.length ?? 0;
    const dup = valid.length - added;

    revalidatePath("/admin/reviews");

    const parts = [`${added}건 담았습니다.`];
    if (dup > 0) parts.push(`이미 있던 ${dup}건은 건너뛰었습니다.`);
    if (invalid.length > 0) parts.push(`주소 형식이 아닌 ${invalid.length}건은 뺐습니다.`);
    return { success: true, message: parts.join(" ") };
  } catch (err) {
    return toActionError(err, "등록에 실패했습니다.");
  }
}

/**
 * 네이버 글 하나를 주소로 직접 담는다.
 *
 * 크론이 못 찾은 글(키워드를 안 쓴 후기 등)을 손으로 넣는 길이다. og 를 받아
 * 제목·요약·썸네일을 채워 둔다 — 게재할 때 손으로 적지 않아도 되게.
 */
export async function addNaverUrl(raw: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const url = normalizeUrl(toNaverMobileUrl(raw.trim()));
    if (!/^https?:\/\/(m\.)?blog\.naver\.com\//.test(url)) {
      return { error: "네이버 블로그 주소가 아닙니다." };
    }

    const og = await fetchOgTags(url);
    const { data, error } = await supabase
      .from("review_candidates")
      .upsert(
        [{
          channel: "naver",
          url,
          title: og.title || null,
          excerpt: og.description || null,
          thumbnail_url: og.image || null,
          status: "new",
        }],
        { onConflict: "url", ignoreDuplicates: true }
      )
      .select("id");
    if (error) return { error: error.message };

    revalidatePath("/admin/reviews");
    return {
      success: true,
      message: (data?.length ?? 0) > 0 ? "담았습니다." : "이미 담겨 있는 글입니다.",
    };
  } catch (err) {
    return toActionError(err, "등록에 실패했습니다.");
  }
}
