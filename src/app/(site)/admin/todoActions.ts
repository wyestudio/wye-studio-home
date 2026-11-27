"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { TODO_TEXT_MAX, isDismissableKey } from "@/lib/adminTodos";
import { charCount, cleanLine } from "@/lib/textClean";

/**
 * 관리자 홈 「오늘 할 일」 — 직접 적은 일과 끝냄 체크.
 *
 * 화면에서도 거르지만 여기서 한 번 더 본다(서버 액션은 화면을 거치지 않고도 불린다). DB 제약도 같은 규칙이다
 * (supabase/migrations/…_admin_todos.sql).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 할 일 직접 등록. */
export async function addTodo(text: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const t = cleanLine(text);
    if (!t) return { error: "할 일을 적어주세요." };
    if (charCount(t) > TODO_TEXT_MAX) return { error: `${TODO_TEXT_MAX}자까지 쓸 수 있어요.` };
    const { error } = await supabase.from("admin_todos").insert({ text: t });
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return toActionError(err, "등록에 실패했습니다.");
  }
}

/** 직접 적은 일을 끝냄 / 다시 남은 일로. */
export async function setTodoDone(id: string, done: boolean): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (!UUID.test(id)) return { error: "할 일을 찾을 수 없습니다." };
    const { error } = await supabase
      .from("admin_todos")
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 직접 적은 일 삭제. */
export async function deleteTodo(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (!UUID.test(id)) return { error: "할 일을 찾을 수 없습니다." };
    const { error } = await supabase.from("admin_todos").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return toActionError(err, "삭제에 실패했습니다.");
  }
}

/** 자동으로 생긴 할 일을 끝냄 / 다시 남은 일로. 체크할 수 있는 키만 받는다. */
export async function setAutoTodoDone(key: string, done: boolean): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (!isDismissableKey(key)) return { error: "이 할 일은 체크할 수 없습니다." };
    const { error } = done
      ? await supabase.from("admin_todo_dismissals").upsert({ todo_key: key }, { onConflict: "todo_key", ignoreDuplicates: true })
      : await supabase.from("admin_todo_dismissals").delete().eq("todo_key", key);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}
