"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { EVENT_BUBBLE_KEY, SITE_SETTINGS_TAG } from "@/lib/siteSettings";

/**
 * 공지·FAQ 편집.
 *
 * 예전에는 두 컴포넌트에 배열로 하드코딩돼 있어 문구 하나 고치려면 배포가
 * 필요했다. 정기 운영에서 가장 자주 바뀌는 부분이다.
 */

export type NoticeInput = {
  id?: string;
  title: string;
  body: string;
  is_pinned: boolean;
  /** 비우면 미게시(초안). 값이 있으면 그 시각부터 공개된다. */
  published_at: string | null;
  sort_order: number;
};

export type FaqInput = {
  id?: string;
  question: string;
  answer: string;
  category: string;
  is_visible: boolean;
  sort_order: number;
};

export async function saveNotice(input: NoticeInput): Promise<ActionResult> {
  try {
    if (!input.title.trim()) return { error: "제목을 입력해주세요." };
    if (!input.body.trim()) return { error: "내용을 입력해주세요." };

    const supabase = await requireAdmin();
    const row = {
      title: input.title.trim(),
      body: input.body.trim(),
      is_pinned: input.is_pinned,
      published_at: input.published_at,
      sort_order: input.sort_order,
      updated_at: new Date().toISOString(),
    };

    const { error } = input.id
      ? await supabase.from("notices").update(row).eq("id", input.id)
      : await supabase.from("notices").insert(row);
    if (error) throw error;

    await writeAuditLog({
      action: "notice.saved",
      targetType: "notice",
      targetId: input.id ?? "(신규)",
      summary: `공지 저장 — ${input.title}`,
    });

    revalidatePath("/admin/content");
    revalidatePath("/notice");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "공지 저장 실패");
  }
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "notice.deleted",
      targetType: "notice",
      targetId: id,
      summary: "공지 삭제",
    });

    revalidatePath("/admin/content");
    revalidatePath("/notice");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "공지 삭제 실패");
  }
}

export async function saveFaq(input: FaqInput): Promise<ActionResult> {
  try {
    if (!input.question.trim()) return { error: "질문을 입력해주세요." };
    if (!input.answer.trim()) return { error: "답변을 입력해주세요." };

    const supabase = await requireAdmin();
    const row = {
      question: input.question.trim(),
      answer: input.answer.trim(),
      category: input.category.trim() || null,
      is_visible: input.is_visible,
      sort_order: input.sort_order,
      updated_at: new Date().toISOString(),
    };

    const { error } = input.id
      ? await supabase.from("faqs").update(row).eq("id", input.id)
      : await supabase.from("faqs").insert(row);
    if (error) throw error;

    await writeAuditLog({
      action: "faq.saved",
      targetType: "faq",
      targetId: input.id ?? "(신규)",
      summary: `FAQ 저장 — ${input.question}`,
    });

    revalidatePath("/admin/content");
    revalidatePath("/notice");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "FAQ 저장 실패");
  }
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "faq.deleted",
      targetType: "faq",
      targetId: id,
      summary: "FAQ 삭제",
    });

    revalidatePath("/admin/content");
    revalidatePath("/notice");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "FAQ 삭제 실패");
  }
}

/**
 * 우하단 이벤트 말풍선(인스타 버튼 위) 설정.
 *
 * 고객 화면은 site_settings 의 'public.event_bubble' 을 읽는다(src/lib/siteSettings.ts).
 * 이벤트가 끝나면 여기서 끄면 되고, 배포는 필요 없다.
 */
export async function saveEventBubble(input: {
  enabled: boolean;
  text: string;
}): Promise<ActionResult> {
  try {
    const text = input.text.trim();
    if (input.enabled && !text) return { error: "말풍선을 켜려면 문구를 입력해주세요." };
    if (text.length > 60) return { error: "문구는 60자 이내로 적어주세요. 두 줄이 넘으면 잘립니다." };

    const supabase = await requireAdmin();
    const { error } = await supabase.from("site_settings").upsert(
      {
        key: EVENT_BUBBLE_KEY,
        value: { enabled: input.enabled, text },
        description: "우하단 인스타 버튼 위 말풍선. 어드민 > 공지·FAQ 화면에서 켜고 끈다.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) throw error;

    await writeAuditLog({
      action: "site_setting.saved",
      targetType: "site_setting",
      targetId: EVENT_BUBBLE_KEY,
      summary: `이벤트 말풍선 ${input.enabled ? "켬" : "끔"} — ${text || "(문구 없음)"}`,
    });

    // 고객 화면이 30초간 들고 있는 값이라 저장하자마자 털어준다.
    updateTag(SITE_SETTINGS_TAG);
    revalidatePath("/admin/content");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "이벤트 말풍선 저장 실패");
  }
}
