"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { normalizeThemeContent, type ThemeBlock, type ThemeContent } from "@/types/catalog";

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
  hero_image_path: string;
  logo_image_path: string;
  title_font: string;
  opening_date: string | null;
  category_id: string | null;
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
/**
 * 저장 전 콘텐츠 정리.
 *
 * 어드민이 보내는 JSON 을 그대로 믿지 않는다. 알려진 블록 종류만 남기고
 * 각 필드를 문자열/숫자로 강제한다 — 화면이 기대하지 않는 모양이 들어오면
 * 상세 페이지가 통째로 깨진다.
 */
function sanitizeContent(raw: unknown): ThemeContent {
  const parsed = normalizeThemeContent(raw);
  const str = (v: unknown) => String(v ?? "");

  const blocks = parsed.blocks
    .filter((b) => b && typeof b === "object" && "type" in b)
    .map((b): ThemeBlock | null => {
      const arr = (v: unknown) => (Array.isArray(v) ? v : []);
      // 모든 블록이 공통으로 갖는 머리말. 비어 있으면 아예 넣지 않는다.
      const common = { title: str(b.title), ...(str(b.eyebrow) ? { eyebrow: str(b.eyebrow) } : {}) };
      switch (b.type) {
        case "text":
          return { ...common, type: "text", body: str(b.body) };
        case "list":
          return {
            ...common,
            type: "list",
            variant: b.variant === "step" ? "step" : "card",
            items: arr(b.items).map((x) => ({
              emoji: str((x as Record<string, unknown>)?.emoji),
              title: str((x as Record<string, unknown>)?.title),
              desc: str((x as Record<string, unknown>)?.desc),
            })),
          };
        case "timetable":
          return {
            ...common,
            type: "timetable",
            items: arr(b.items).map((x) => ({
              title: str((x as Record<string, unknown>)?.title),
              desc: str((x as Record<string, unknown>)?.desc),
            })),
          };
        case "callout":
          return {
            ...common,
            type: "callout",
            items: arr(b.items).map((x) => ({
              title: str((x as Record<string, unknown>)?.title),
              desc: str((x as Record<string, unknown>)?.desc),
            })),
          };
        case "faq":
          return {
            ...common,
            type: "faq",
            items: arr(b.items).map((x) => ({
              q: str((x as Record<string, unknown>)?.q),
              a: str((x as Record<string, unknown>)?.a),
            })),
          };
        case "image":
          return { ...common, type: "image", src: str(b.src), alt: str(b.alt) };
        default:
          return null;
      }
    })
    .filter((b): b is ThemeBlock => b !== null);

  return { blocks };
}

function validate(input: ThemeInput): string | null {
  if (!input.slug.trim()) return "slug 를 입력해주세요.";
  if (!/^[a-z0-9-]+$/.test(input.slug.trim())) return "slug 는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.";
  if (!input.name.trim()) return "테마 이름을 입력해주세요.";
  if (!input.venue_id) return "장소를 선택해주세요.";
  // ⚠️ 숫자 칸을 비우면 <input type="number"> 가 "" 를 주고 Number("") 은 0 이다.
  //    여기서 안 걸러내면 DB CHECK 제약에 막혀 "테마 저장 실패: new row for
  //    relation ... violates check constraint" 같은 원문이 그대로 뜬다.
  if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5)
    return "난이도를 1~5 사이로 입력해주세요.";
  if (input.duration_minutes <= 0) return "소요시간을 입력해주세요.";
  if (input.min_age_floor !== null && (input.min_age_floor < 0 || input.min_age_floor > 100))
    return "최소 연령은 0~100 사이로 입력해주세요.";
  if (input.capacity_min !== null && input.capacity_min < 1)
    return "최소 진행 인원은 1명 이상이어야 합니다.";
  if (input.max_group_size !== null && input.max_group_size < 1)
    return "최대 그룹 인원은 1명 이상이어야 합니다.";
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
      hero_image_path: input.hero_image_path.trim() || null,
      logo_image_path: input.logo_image_path.trim() || null,
      title_font: input.title_font.trim() || null,
      opening_date: input.opening_date || null,
      category_id: input.category_id || null,
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
