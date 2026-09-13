"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAuth } from "@/lib/adminAuth";
import { writeAuditLog } from "@/lib/auditLog";

export async function updateSlackTemplate(
  key: string,
  body: string
): Promise<{ error?: string; success?: true }> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  if (!body.trim()) {
    return { error: "본문은 비워둘 수 없습니다." };
  }

  const supabase = createAdminClient();

  // 고쳐지기 전 본문을 먼저 읽어둔다. 잘못 고쳤을 때 감사로그에서 되돌린다.
  const { data: before } = await supabase
    .from("slack_templates")
    .select("body")
    .eq("key", key)
    .single();

  const { error } = await supabase
    .from("slack_templates")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    return { error: "저장 실패: " + error.message };
  }

  console.log(`[admin] 슬랙 템플릿 수정됨: ${key}`);

  await writeAuditLog({
    action: "slack_template.updated",
    targetType: "slack_template",
    targetId: key,
    summary: `슬랙 포맷 수정 — ${key}`,
    detail: { previous_body: before?.body ?? null, new_length: body.length },
  });

  return { success: true };
}
