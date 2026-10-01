"use server";

import { updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { POPUPS_TAG } from "@/lib/popups";
import type { PopupPage } from "@/types/popup";

/**
 * 접속 팝업 저장.
 *
 * ⚠️ 켜는 순간 **고객 전원에게 바로 뜬다.** 이미지를 바꾸는 것도 마찬가지다.
 *    그래서 새로 만들 때 기본값은 '꺼짐' 이고, 켜기 전에 한 번 더 확인한다.
 *
 * ⚠️ 시각은 전부 KST 로 해석한다(프로모션과 같은 규칙).
 */

export type PopupInput = {
  id?: string;
  title: string;
  image_url: string;
  image_alt: string;
  body: string;
  link_url: string;
  link_label: string;
  pages: PopupPage[];
  /** 'YYYY-MM-DDTHH:mm' (KST). 비우면 제한 없음. */
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  sort: number;
};

function kstDateTimeToIso(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const withSeconds = s.length === 16 ? `${s}:00` : s;
  return new Date(`${withSeconds}+09:00`).toISOString();
}

function validate(input: PopupInput): string | null {
  if (!input.title.trim()) return "팝업 이름을 입력해주세요.";
  // 이미지도 문구도 없으면 빈 상자가 뜬다. DB 제약과 같은 조건을 먼저 안내한다.
  if (!input.image_url.trim() && !input.body.trim())
    return "이미지나 안내 문구 중 하나는 있어야 합니다.";
  if (input.pages.length === 0) return "팝업을 띄울 화면을 하나 이상 골라주세요.";

  const link = input.link_url.trim();
  if (link && !/^(\/|https:\/\/)/.test(link))
    return "이동 링크는 '/' 로 시작하는 사이트 내 경로이거나 https:// 주소여야 합니다.";

  const from = kstDateTimeToIso(input.starts_at);
  const until = kstDateTimeToIso(input.ends_at);
  if (from && until && from > until) return "게시 시작이 게시 종료보다 늦습니다.";

  return null;
}

export async function savePopup(input: PopupInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();

    const row = {
      title: input.title.trim(),
      image_url: input.image_url.trim() || null,
      image_alt: input.image_alt.trim() || null,
      body: input.body.trim() || null,
      link_url: input.link_url.trim() || null,
      link_label: input.link_label.trim() || null,
      pages: input.pages,
      starts_at: kstDateTimeToIso(input.starts_at),
      ends_at: kstDateTimeToIso(input.ends_at),
      is_active: input.is_active,
      sort: input.sort,
      updated_at: new Date().toISOString(),
    };

    let popupId = input.id ?? "";
    if (input.id) {
      const { error } = await supabase.from("popups").update(row).eq("id", input.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("popups").insert(row).select("id").single();
      if (error) throw error;
      popupId = data.id as string;
    }

    await writeAuditLog({
      action: "popup.saved",
      targetType: "popup",
      targetId: popupId,
      summary: `${row.title} (${row.is_active ? "게시" : "비게시"})`,
      detail: { pages: row.pages, starts_at: row.starts_at, ends_at: row.ends_at },
    });

    updateTag(POPUPS_TAG);
    return { success: true, message: "저장되었습니다." };
  } catch (err) {
    return toActionError(err, "팝업 저장 실패");
  }
}

export async function deletePopup(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("popups").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({ action: "popup.deleted", targetType: "popup", targetId: id });
    updateTag(POPUPS_TAG);
    return { success: true, message: "삭제되었습니다." };
  } catch (err) {
    return toActionError(err, "팝업 삭제 실패");
  }
}

/** 목록에서 바로 게시/내림. */
export async function setPopupActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("popups")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "popup.saved",
      targetType: "popup",
      targetId: id,
      summary: active ? "게시 켬" : "게시 내림",
    });
    updateTag(POPUPS_TAG);
    return { success: true, message: active ? "게시했습니다." : "내렸습니다." };
  } catch (err) {
    return toActionError(err, "팝업 상태 변경 실패");
  }
}
