"use server";

import { createClient } from "@/lib/supabase/server";
import type { Application } from "@/types/domain";

export type ApplyState = {
  error?: string;
  application?: Application;
};

export async function applyAction(
  _prevState: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const depositorName = String(formData.get("depositorName") ?? "").trim();
  const agreedTerms = formData.get("agreedTerms") === "on";

  if (!sessionId) {
    return { error: "잘못된 접근입니다." };
  }
  if (!depositorName) {
    return { error: "입금자명을 입력해주세요." };
  }
  if (!agreedTerms) {
    return { error: "약관에 동의해야 신청할 수 있습니다." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("apply_and_recompute", {
      p_session_id: sessionId,
      p_depositor_name: depositorName,
      p_agreed_terms: agreedTerms,
    })
    .single();

  if (error) {
    return { error: error.message };
  }

  return { application: data as Application };
}
