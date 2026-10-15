import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRatingSummary } from "@/lib/reviewRating";

/**
 * 설문 평점을 테마의 후기 블록 수치에 반영한다.
 *
 * ⚠️ `auto` 표시가 붙은 항목만 바꾼다. 표시가 없는 수치는 운영자가 손으로 적은
 *    값이라 건드리지 않는다 — 자동 갱신이 사람이 적은 값을 덮으면 되돌릴 길이 없다.
 *
 * ⚠️ 바뀐 게 없으면 **쓰지 않는다.** 매일 같은 값으로 UPDATE 하면 수정 이력이
 *    의미 없어지고 캐시도 공연히 털린다.
 */
export async function updateRatingStats(
  supabase: SupabaseClient
): Promise<{ updated: string[]; errors: string[]; summary: string | null }> {
  const res = await fetchRatingSummary();
  if (!res.ok) return { updated: [], errors: [res.error], summary: null };

  const { average, count, column } = res.summary;
  if (average === null || count === 0) {
    return { updated: [], errors: [], summary: "응답이 아직 없습니다." };
  }

  const { data: themes, error } = await supabase.from("themes").select("id, slug, content");
  if (error) return { updated: [], errors: [error.message], summary: null };

  const updated: string[] = [];
  const errors: string[] = [];

  for (const t of (themes ?? []) as { id: string; slug: string; content: unknown }[]) {
    const content = (t.content ?? {}) as { blocks?: Record<string, unknown>[] };
    if (!Array.isArray(content.blocks)) continue;

    let touched = false;
    const blocks = content.blocks.map((b) => {
      if (b?.type !== "reviews" || !Array.isArray(b.stats)) return b;

      const stats = (b.stats as Record<string, unknown>[]).map((st) => {
        if (st?.auto !== "rating" && st?.auto !== "count") return st;
        const next = st.auto === "rating" ? String(average) : String(count);
        if (String(st.value ?? "") === next) return st;
        touched = true;
        return {
          ...st,
          value: next,
          // 어디서 나온 숫자인지 남긴다 — 수치만 있으면 나중에 근거를 못 되짚는다.
          note: `설문 응답 ${count}명${column ? ` · ${column}` : ""}`,
        };
      });

      return { ...b, stats };
    });

    if (!touched) continue;

    const { error: upErr } = await supabase
      .from("themes")
      .update({ content: { ...content, blocks } })
      .eq("id", t.id);
    if (upErr) errors.push(`${t.slug}: ${upErr.message}`);
    else updated.push(t.slug);
  }

  return {
    updated,
    errors,
    summary: `평균 ${average} · 응답 ${count}명${column ? ` (${column})` : ""}`,
  };
}
