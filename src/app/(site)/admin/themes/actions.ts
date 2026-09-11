"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { EMPTY_THEME_CONTENT, type ThemeContent } from "@/types/catalog";

export type PriceTierInput = {
  min_headcount: number;
  unit_price_krw: number;
  original_unit_price_krw: number | null;
};

export type ThemeInput = {
  id?: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  difficulty: number;
  duration_minutes: number;
  min_age_floor: number | null;
  capacity_confirm_line: number;
  capacity_max: number;
  capacity_min: number | null;
  max_group_size: number | null;
  venue_id: string;
  accent_color: string;
  content: ThemeContent;
  is_active: boolean;
  is_listed: boolean;
  sort_order: number;
  tiers: PriceTierInput[];
};

/**
 * content(jsonb)는 DB 가 구조를 검증해주지 않으므로 저장 전에 앱에서 검증한다.
 * 설계 근거: docs/07-architecture-domain-and-data.md §4-2
 */
function sanitizeContent(raw: unknown): ThemeContent {
  const c = (raw ?? {}) as Partial<ThemeContent>;
  const block = <T extends Record<string, unknown>>(arr: unknown, keys: (keyof T)[]): T[] =>
    Array.isArray(arr)
      ? arr
          .filter((x) => x && typeof x === "object")
          .map((x) => {
            const out = {} as Record<string, unknown>;
            for (const k of keys) out[k as string] = (x as Record<string, unknown>)[k as string] ?? "";
            return out as T;
          })
      : [];

  return {
    for_you: block(c.for_you, ["emoji", "title", "desc"]),
    steps: block(c.steps, ["emoji", "title", "desc"]),
    timetable: (Array.isArray(c.timetable) ? c.timetable : [])
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        offset_min: Number((x as { offset_min?: unknown }).offset_min) || 0,
        title: String((x as { title?: unknown }).title ?? ""),
        desc: String((x as { desc?: unknown }).desc ?? ""),
      })),
    precautions: block(c.precautions, ["title", "desc"]),
  };
}

function validate(input: ThemeInput): string | null {
  if (!input.slug.trim()) return "slug 를 입력해주세요.";
  if (!/^[a-z0-9-]+$/.test(input.slug.trim())) return "slug 는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.";
  if (!input.name.trim()) return "테마 이름을 입력해주세요.";
  if (!input.venue_id) return "장소를 선택해주세요.";
  if (input.duration_minutes <= 0) return "소요시간을 입력해주세요.";
  if (input.capacity_confirm_line <= 0 || input.capacity_max <= 0) return "정원을 입력해주세요.";
  if (input.capacity_confirm_line > input.capacity_max)
    return "즉시확정 인원은 정원보다 클 수 없습니다.";
  if (input.tiers.length === 0) return "요금 구간을 최소 1개 등록해주세요.";
  if (!input.tiers.some((t) => t.min_headcount === 1))
    return "1인 기준 요금 구간이 반드시 있어야 합니다.";

  const seen = new Set<number>();
  for (const t of input.tiers) {
    if (t.min_headcount < 1) return "요금 구간의 인원은 1 이상이어야 합니다.";
    if (seen.has(t.min_headcount)) return `인원 ${t.min_headcount}명 구간이 중복됩니다.`;
    seen.add(t.min_headcount);
    if (t.unit_price_krw < 0) return "가격은 0 이상이어야 합니다.";
    if (t.original_unit_price_krw !== null && t.original_unit_price_krw < t.unit_price_krw)
      return "정가는 판매가보다 작을 수 없습니다.";
  }
  return null;
}

export async function saveTheme(input: ThemeInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();
    const row = {
      slug: input.slug.trim(),
      name: input.name.trim(),
      tagline: input.tagline.trim() || null,
      description: input.description.trim() || null,
      difficulty: input.difficulty,
      duration_minutes: input.duration_minutes,
      min_age_floor: input.min_age_floor,
      capacity_confirm_line: input.capacity_confirm_line,
      capacity_max: input.capacity_max,
      capacity_min: input.capacity_min,
      max_group_size: input.max_group_size,
      venue_id: input.venue_id,
      accent_color: input.accent_color.trim() || null,
      content: sanitizeContent(input.content),
      is_active: input.is_active,
      is_listed: input.is_listed,
      sort_order: input.sort_order,
      updated_at: new Date().toISOString(),
    };

    let themeId = input.id;
    if (themeId) {
      const { error } = await supabase.from("themes").update(row).eq("id", themeId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("themes").insert(row).select("id").single();
      if (error) throw error;
      themeId = data.id as string;
    }

    // 요금 구간은 통째로 교체한다(부분 수정보다 의도가 명확하고 잔여 행이 남지 않는다).
    const { error: delErr } = await supabase
      .from("theme_price_tiers")
      .delete()
      .eq("theme_id", themeId);
    if (delErr) throw delErr;

    const { error: tierErr } = await supabase.from("theme_price_tiers").insert(
      input.tiers.map((t) => ({
        theme_id: themeId,
        min_headcount: t.min_headcount,
        unit_price_krw: t.unit_price_krw,
        original_unit_price_krw: t.original_unit_price_krw,
      }))
    );
    if (tierErr) throw tierErr;

    revalidatePath("/admin/themes");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "테마 저장 실패");
  }
}

export async function deleteTheme(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("theme_id", id);

    if (count && count > 0) {
      return {
        error: `이 테마에 회차가 ${count}개 있어 삭제할 수 없습니다. 판매를 멈추려면 '노출/신청'을 꺼주세요.`,
      };
    }

    const { error } = await supabase.from("themes").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/themes");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "테마 삭제 실패");
  }
}

export const EMPTY_CONTENT = EMPTY_THEME_CONTENT;
