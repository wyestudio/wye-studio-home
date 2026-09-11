"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";

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

    revalidatePath("/admin/content");
    revalidatePath("/notice");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "FAQ 삭제 실패");
  }
}
