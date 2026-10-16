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
        const num = st.auto === "rating" ? String(average) : String(count);
        // 숫자 뒤에 운영자가 붙여 둔 꼬리("4.6 / 5" 의 " / 5", "64명" 의 "명")는 살린다.
        // 숫자만 바꿔 넣지 않으면 자동 갱신 첫날 화면 표기가 "4.4" 로 바뀌어 버린다.
        const prev = String(st.value ?? "");
        const tail = prev.match(/^\s*\d+(?:\.\d+)?(.*)$/)?.[1] ?? "";
        const next = `${num}${tail}`;
        // 근거는 공개 화면에 그대로 찍힌다(ThemeBlocks). 문항 원문은 길고 고객에게
        // 의미가 없으니 응답 수만 남긴다 — 어느 열을 읽었는지는 크론 응답에서 본다.
        const note = `설문 응답 ${count}명`;
        if (prev === next && st.note === note) return st;
        touched = true;
        return { ...st, value: next, note };
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
