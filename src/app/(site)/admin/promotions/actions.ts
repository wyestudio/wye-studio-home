"use server";

import { updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { PROMOTION_TAG } from "@/lib/promotions";

/**
 * 프로모션(얼리버드) 저장.
 *
 * ⚠️ 여기서 정하는 금액이 그대로 고객 청구액이 된다. 화면이 보여주는 금액과
 *    실제 금액이 갈리지 않도록, 신청 순간에는 DB 의 resolve_promotion_price()
 *    가 **같은 값을 다시** 읽는다. 저장 규칙을 바꾸면 그 함수도 같이 본다
 *    (supabase/migrations/..._promotions_and_popups.sql).
 *
 * ⚠️ 시각은 전부 **KST 로 해석**한다. 어드민을 해외에서 열어도 '10월 31일
 *    23시 59분' 이 한국 시각 그대로여야 한다.
 */

export type PromotionTierInput = {
  theme_id: string;
  min_headcount: number;
  unit_price_krw: number;
};

export type PromotionInput = {
  id?: string;
  name: string;
  is_active: boolean;
  /** 'YYYY-MM-DDTHH:mm' (KST). 비우면 제한 없음. */
  applies_from: string;
  applies_until: string;
  /** 'YYYY-MM-DD' (KST). 비우면 제한 없음. */
  session_from: string;
  session_to: string;
  days_before: number;
  badge_label: string;
  banner_title: string;
  banner_body: string;
  banner_highlight: string;
  banner_note: string;
  accent_color: string;
  tiers: PromotionTierInput[];
};

/** 'YYYY-MM-DDTHH:mm' 을 KST 로 못박아 ISO 로. 비었으면 null. */
function kstDateTimeToIso(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  // 초가 없으면 붙인다. 오프셋을 직접 적어 서버 시간대와 무관하게 만든다.
  const withSeconds = s.length === 16 ? `${s}:00` : s;
  return new Date(`${withSeconds}+09:00`).toISOString();
}

function validate(input: PromotionInput): string | null {
  if (!input.name.trim()) return "프로모션 이름을 입력해주세요.";
  if (!input.badge_label.trim()) return "배지 문구를 입력해주세요.";
  if (!Number.isInteger(input.days_before) || input.days_before < 0)
    return "'며칠 전까지' 는 0 이상의 정수여야 합니다.";
  if (!/^#[0-9a-fA-F]{6}$/.test(input.accent_color))
    return "강조색은 #ff73b4 처럼 여섯 자리 색상코드로 입력해주세요.";

  const from = kstDateTimeToIso(input.applies_from);
  const until = kstDateTimeToIso(input.applies_until);
  if (from && until && from > until) return "접수 시작이 접수 종료보다 늦습니다.";

  const sf = input.session_from.trim();
  const st = input.session_to.trim();
  if (sf && st && sf > st) return "회차 진행일 범위의 시작이 끝보다 늦습니다.";

  const seen = new Set<string>();
  for (const t of input.tiers) {
    if (!t.theme_id) return "얼리버드 금액의 테마를 골라주세요.";
    if (!Number.isInteger(t.min_headcount) || t.min_headcount < 1)
      return "인원 구간은 1 이상의 정수여야 합니다.";
    if (!Number.isInteger(t.unit_price_krw) || t.unit_price_krw < 0)
      return "얼리버드 금액은 0 이상의 정수여야 합니다.";
    const key = `${t.theme_id}:${t.min_headcount}`;
    if (seen.has(key)) return `같은 테마에 ${t.min_headcount}인 구간이 두 번 있습니다.`;
    seen.add(key);
  }
  return null;
}

export async function savePromotion(input: PromotionInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();

    /*
      ⚠️ 얼리버드가가 기본가보다 **싸지 않으면 저장 자체를 막는다.**
         DB 와 화면이 각각 "싸지 않으면 무시" 로 걸러 주긴 하지만, 그러면
         운영자는 켜 놓고도 할인이 안 먹는 이유를 알 수 없다. 숫자를 넣는
         자리에서 바로 알려주는 게 맞다.
    */
    if (input.tiers.length > 0) {
      const themeIds = [...new Set(input.tiers.map((t) => t.theme_id))];
      const { data: baseTiers, error: baseErr } = await supabase
        .from("theme_price_tiers")
        .select("theme_id, min_headcount, unit_price_krw")
        .in("theme_id", themeIds);
      if (baseErr) throw baseErr;

      for (const t of input.tiers) {
        // 기본가도 '구간 이상' 규칙이라 같은 방식으로 고른다.
        const base = (baseTiers ?? [])
          .filter((b) => b.theme_id === t.theme_id && b.min_headcount <= t.min_headcount)
          .sort((a, b) => b.min_headcount - a.min_headcount)[0];
        if (!base) {
          return {
            error: `${t.min_headcount}인 구간에 해당하는 기본 요금이 테마에 없습니다. 테마의 '요금 구간' 을 먼저 확인해주세요.`,
          };
        }
        if (t.unit_price_krw >= base.unit_price_krw) {
          return {
            error: `${t.min_headcount}인 얼리버드 금액(${t.unit_price_krw.toLocaleString()}원)이 기본가(${base.unit_price_krw.toLocaleString()}원)보다 싸지 않습니다. 이대로 켜면 할인이 적용되지 않습니다.`,
          };
        }
      }
    }

    // 켜진 프로모션은 하나뿐이다(DB 부분 유니크 인덱스). 먼저 확인해서
    // 'duplicate key' 대신 사람이 읽을 수 있는 문구로 돌려준다.
    if (input.is_active) {
      const { data: others } = await supabase
        .from("promotions")
        .select("id, name")
        .eq("is_active", true);
      const conflict = (others ?? []).find((o) => o.id !== input.id);
      if (conflict) {
        return {
          error: `이미 '${conflict.name}' 프로모션이 켜져 있습니다. 한 번에 하나만 켤 수 있어요 — 그것을 먼저 끄고 다시 저장해주세요.`,
        };
      }
    }

    const row = {
      name: input.name.trim(),
      is_active: input.is_active,
      applies_from: kstDateTimeToIso(input.applies_from),
      applies_until: kstDateTimeToIso(input.applies_until),
      session_from: input.session_from.trim() || null,
      session_to: input.session_to.trim() || null,
      days_before: input.days_before,
      badge_label: input.badge_label.trim(),
      banner_title: input.banner_title.trim() || null,
      banner_body: input.banner_body.trim() || null,
      banner_highlight: input.banner_highlight.trim() || null,
      banner_note: input.banner_note.trim() || null,
      accent_color: input.accent_color.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    let promotionId = input.id ?? "";
    if (input.id) {
      const { error } = await supabase.from("promotions").update(row).eq("id", input.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("promotions")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      promotionId = data.id as string;
    }

    // 금액 구간은 통째로 갈아끼운다. 지운 구간이 남아 있으면 안 되기 때문이다.
    const { error: delErr } = await supabase
      .from("promotion_price_tiers")
      .delete()
      .eq("promotion_id", promotionId);
    if (delErr) throw delErr;

    if (input.tiers.length > 0) {
      const { error: insErr } = await supabase.from("promotion_price_tiers").insert(
        input.tiers.map((t) => ({
          promotion_id: promotionId,
          theme_id: t.theme_id,
          min_headcount: t.min_headcount,
          unit_price_krw: t.unit_price_krw,
        }))
      );
      if (insErr) throw insErr;
    }

    await writeAuditLog({
      action: "promotion.saved",
      targetType: "promotion",
      targetId: promotionId,
      // 금액이 바뀐 기록은 남겨야 한다 — 나중에 "그때 얼마였나" 를 묻게 된다.
      detail: {
        name: row.name,
        is_active: row.is_active,
        days_before: row.days_before,
        session_from: row.session_from,
        session_to: row.session_to,
        tiers: input.tiers,
      },
    });

    updateTag(PROMOTION_TAG);
    return { success: true, message: "저장되었습니다." };
  } catch (err) {
    return toActionError(err, "프로모션 저장 실패");
  }
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    // 금액 구간은 on delete cascade 로 같이 지워진다.
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({ action: "promotion.deleted", targetType: "promotion", targetId: id });
    updateTag(PROMOTION_TAG);
    return { success: true, message: "삭제되었습니다." };
  } catch (err) {
    return toActionError(err, "프로모션 삭제 실패");
  }
}

/** 목록에서 바로 켜고 끈다. 저장 화면을 열지 않아도 되게. */
export async function setPromotionActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    if (active) {
      const { data: others } = await supabase
        .from("promotions")
        .select("id, name")
        .eq("is_active", true);
      const conflict = (others ?? []).find((o) => o.id !== id);
      if (conflict) {
        return {
          error: `이미 '${conflict.name}' 프로모션이 켜져 있습니다. 한 번에 하나만 켤 수 있어요.`,
        };
      }
    }

    const { error } = await supabase
      .from("promotions")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: active ? "promotion.activated" : "promotion.deactivated",
      targetType: "promotion",
      targetId: id,
    });
    updateTag(PROMOTION_TAG);
    return { success: true, message: active ? "켰습니다." : "껐습니다." };
  } catch (err) {
    return toActionError(err, "프로모션 상태 변경 실패");
  }
}
