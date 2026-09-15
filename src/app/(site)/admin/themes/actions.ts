"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { THEMES_TAG } from "@/lib/themes";
import {
  parseThemeContent,
  THEME_CONTENT_VERSION,
  GENRE_MAX_COUNT,
  GENRE_MAX_LENGTH,
  type ThemeBlock,
  type ThemeContent,
} from "@/types/catalog";

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
  genres: string[];
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
  is_locked: boolean;
  sort_order: number;
  tiers: PriceTierInput[];
  /** 편집 화면을 열 때의 themes.updated_at. 저장 시 옛 화면인지 가려내는 데 쓴다. 새 테마는 null. */
  loaded_updated_at?: string | null;
};

const STALE_FORM_ERROR =
  "이 화면을 연 뒤에 테마가 다른 곳에서 수정됐어요. 그대로 저장하면 그 내용을 덮어쓰게 돼서 저장하지 않았어요. 새로고침한 뒤 다시 수정해주세요.";

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
  // ⚠️ parseThemeContent 다. normalizeThemeContent 를 쓰면 v1 테마에서 운영자가
  //    방금 지운 가격표 블록이 저장하면서 되살아난다.
  const parsed = parseThemeContent(raw);
  const str = (v: unknown) => String(v ?? "");

  const blocks = parsed.blocks
    .filter((b) => b && typeof b === "object" && "type" in b)
    .map((b): ThemeBlock | null => {
      const arr = (v: unknown) => (Array.isArray(v) ? v : []);
      // 모든 블록이 공통으로 갖는 머리말. 비어 있으면 아예 넣지 않는다.
      // ⚠️ hidden 을 빠뜨리면 저장할 때마다 숨김이 풀린다.
      const common = {
        title: str(b.title),
        ...(str(b.eyebrow) ? { eyebrow: str(b.eyebrow) } : {}),
        ...(b.hidden ? { hidden: true } : {}),
      };
      switch (b.type) {
        case "text":
          return { ...common, type: "text", body: str(b.body) };
        // 가격표는 들고 있는 값이 없다. 숫자는 theme_price_tiers 에서 온다.
        case "price":
          return { ...common, type: "price" };
        case "list": {
          /*
            ⚠️ 여기서 아는 값만 남기므로, 새 variant 를 만들면 **반드시 같이
               적어야 한다.** 안 그러면 어드민에서 저장하는 순간 조용히 'card'
               로 바뀐다 — included 를 추가하고 이걸 빠뜨려서 실제로 그랬다.
          */
          const variant =
            b.variant === "step" || b.variant === "included"
              ? (b.variant as "step" | "included")
              : ("card" as const);
          return {
            ...common,
            type: "list",
            variant,
            // included 전용 칸. 다른 모양에서는 넣지 않는다.
            ...(variant === "included"
              ? {
                  ...(str(b.headline) ? { headline: str(b.headline) } : {}),
                  ...(str(b.subtitle) ? { subtitle: str(b.subtitle) } : {}),
                  ...(str(b.highlight) ? { highlight: str(b.highlight) } : {}),
                  ...(str(b.footnote) ? { footnote: str(b.footnote) } : {}),
                }
              : {}),
            items: arr(b.items).map((x) => ({
              emoji: str((x as Record<string, unknown>)?.emoji),
              title: str((x as Record<string, unknown>)?.title),
              desc: str((x as Record<string, unknown>)?.desc),
            })),
          };
        }
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
        case "reviews":
          return {
            ...common,
            type: "reviews",
            ...(str(b.subtitle) ? { subtitle: str(b.subtitle) } : {}),
            stats: arr(b.stats).map((x) => {
              const o = x as Record<string, unknown>;
              return {
                value: str(o?.value),
                label: str(o?.label),
                ...(str(o?.note) ? { note: str(o?.note) } : {}),
              };
            }),
            quotes: arr(b.quotes).map((x) => {
              const o = x as Record<string, unknown>;
              return { text: str(o?.text), ...(str(o?.meta) ? { meta: str(o?.meta) } : {}) };
            }),
            links: arr(b.links).map((x) => {
              const o = x as Record<string, unknown>;
              const channel = o?.channel === "naver" ? ("naver" as const) : ("instagram" as const);
              return {
                channel,
                url: str(o?.url),
                ...(str(o?.author) ? { author: str(o?.author) } : {}),
                ...(str(o?.date) ? { date: str(o?.date) } : {}),
                // 아래 셋은 네이버 카드를 그릴 때만 쓴다. 인스타는 임베드가 다 그린다.
                ...(channel === "naver"
                  ? {
                      ...(str(o?.title) ? { title: str(o?.title) } : {}),
                      ...(str(o?.excerpt) ? { excerpt: str(o?.excerpt) } : {}),
                      ...(str(o?.image) ? { image: str(o?.image) } : {}),
                    }
                  : {}),
              };
            }),
          };
        default:
          return null;
      }
    })
    .filter((b): b is ThemeBlock => b !== null);

  // 저장하는 순간 최신 구조가 된다 — 읽을 때의 가격표 back-fill 이 더는 끼어들지 않는다.
  return { v: THEME_CONTENT_VERSION, blocks };
}

/**
 * 장르 정리. 운영자가 '#로맨스' 로 적든 '로맨스' 로 적든 같게 저장한다.
 * 화면이 # 를 붙여 그리므로 여기서는 뗀다 — 안 떼면 '##로맨스' 가 된다.
 */
function sanitizeGenres(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const g of list) {
    const tag = String(g ?? "").replace(/^#+/, "").replace(/\s+/g, "").trim();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

function validate(input: ThemeInput): string | null {
  if (!input.slug.trim()) return "slug 를 입력해주세요.";
  if (!/^[a-z0-9-]+$/.test(input.slug.trim())) return "slug 는 영문 소문자·숫자·하이픈만 쓸 수 있습니다.";
  if (!input.name.trim()) return "테마 이름을 입력해주세요.";
  if (!input.venue_id) return "장소를 선택해주세요.";
  const genres = sanitizeGenres(input.genres);
  if (genres.length > GENRE_MAX_COUNT) return `장르는 ${GENRE_MAX_COUNT}개까지 넣을 수 있습니다.`;
  if (genres.some((g) => g.length > GENRE_MAX_LENGTH))
    return `장르 하나는 ${GENRE_MAX_LENGTH}자 이내로 적어주세요.`;
  // ⚠️ 숫자 칸을 비우면 <input type="number"> 가 "" 를 주고 Number("") 은 0 이다.
  //    여기서 안 걸러내면 DB CHECK 제약에 막혀 "테마 저장 실패: new row for
  //    relation ... violates check constraint" 같은 원문이 그대로 뜬다.
  // 0 은 '미정' — 아직 만들지 않은 테마를 미리 띄워 둘 때 쓴다. 화면에서는 감춘다.
  if (!Number.isInteger(input.difficulty) || input.difficulty < 0 || input.difficulty > 5)
    return "난이도를 0~5 사이로 입력해주세요. (0 = 미정)";
  if (!Number.isInteger(input.duration_minutes) || input.duration_minutes < 0)
    return "소요시간을 0분 이상으로 입력해주세요. (0 = 미정)";
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
      /*
        장르 값이 아예 안 왔으면 건드리지 않는다. 장르 칸이 생기기 전 화면(옛 코드)이
        보낸 저장이라는 뜻이다 — 빈 배열로 덮으면 다른 사람이 넣어둔 장르가 사라진다.
        2026-09-15 테스트 서버에서 실제로 그렇게 지워졌다.
      */
      ...(Array.isArray(input.genres) ? { genres: sanitizeGenres(input.genres) } : {}),
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
      is_locked: input.is_locked,
      sort_order: input.sort_order,
      updated_at: new Date().toISOString(),
    };

    let themeId = input.id;
    if (themeId) {
      /*
        옛 화면으로 덮어쓰기 방지.

        편집 화면은 열 때 받은 테마 전체를 들고 있다가 저장할 때 통째로 보낸다.
        화면을 열어둔 사이 누가(다른 탭·다른 사람·마이그레이션) 테마를 고쳤다면,
        그 화면으로 저장하는 순간 새 내용이 옛 내용으로 되돌아간다. 2026-09-15 에
        배포 전부터 열려 있던 어드민 탭에서 포인트 컬러만 바꿨는데 시놉시스·장르가
        통째로 지워졌다.

        그래서 **화면을 열 때의 updated_at 과 지금 DB 값이 같을 때만** 저장한다.
        조건을 UPDATE 의 WHERE 에 넣어 확인과 저장 사이에 끼어들 틈을 없앤다.

        ⚠️ loaded_updated_at 은 DB 가 준 문자열 그대로 비교한다. Date 로 바꾸면
           마이크로초가 잘려 멀쩡한 저장이 전부 '충돌' 로 막힌다.
        ⚠️ 이 값을 안 보내는 화면(이 코드 이전 화면)도 막는다 — 옛 화면이기 때문이다.
      */
      if (!input.loaded_updated_at) return { error: STALE_FORM_ERROR };

      const { data: updated, error } = await supabase
        .from("themes")
        .update(row)
        .eq("id", themeId)
        .eq("updated_at", input.loaded_updated_at)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) return { error: STALE_FORM_ERROR };
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

    await writeAuditLog({
      action: "theme.saved",
      targetType: "theme",
      targetId: themeId,
      summary: `테마 저장 — ${input.name} (${input.slug})`,
      detail: {
        slug: input.slug,
        is_active: input.is_active,
        is_listed: input.is_listed,
        is_locked: input.is_locked,
      },
    });

    revalidatePath("/admin/themes");
    // 공개 화면은 테마 데이터를 캐시해 둔다(src/lib/themes.ts).
    // 털어주지 않으면 고친 내용이 최대 5분간 안 보여 "저장이 안 됐나" 싶어진다.
    // ⚠️ revalidateTag 가 아니라 updateTag 다. Next 16 에서 revalidateTag 는
    //    "다음 요청부터" 만 보장하고, 서버 액션 안에서 즉시 반영하려면
    //    updateTag 를 쓰라고 문서가 명시한다. 저장하고 새로고침했는데 옛 내용이
    //    보이면 운영자는 저장이 안 됐다고 생각한다.
    updateTag(THEMES_TAG);
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

    await writeAuditLog({
      action: "theme.deleted",
      targetType: "theme",
      targetId: id,
      summary: "테마 삭제",
    });

    revalidatePath("/admin/themes");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "테마 삭제 실패");
  }
}
