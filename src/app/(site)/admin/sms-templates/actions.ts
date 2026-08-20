"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAuth } from "@/lib/adminAuth";

export async function updateSmsTemplate(key: string, body: string): Promise<{ error?: string; success?: true }> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  if (!body.trim()) {
    return { error: "본문은 비워둘 수 없습니다." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sms_templates")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) {
    return { error: "저장 실패: " + error.message };
  }

  console.log(`[admin] 문자 템플릿 수정됨: ${key}`);

  return { success: true };
}
