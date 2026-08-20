"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccountByEmail } from "@/lib/accountLookup";

export type LoginState = {
  error?: string;
  kind?: "no_account" | "wrong_password" | "social_only";
  provider?: "kakao" | "naver";
  email?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 비밀번호가 실제로 틀린 것/계정이 아예 없는 것/카카오·네이버 전용
    // 계정이라 비밀번호가 없는 것을 구분해서 안내하기 위해, 실패했을 때만
    // service_role RPC로 이메일을 대조한다(성공 경로는 추가 비용 없음).
    const admin = createAdminClient();
    const match = await findAccountByEmail(admin, email);

    if (match.status === "not_found") {
      return { kind: "no_account", email, error: "가입된 계정을 찾을 수 없어요." };
    }
    if (match.status === "social_only") {
      const label = match.provider === "kakao" ? "카카오" : "네이버";
      return {
        kind: "social_only",
        provider: match.provider,
        email,
        error: `${label}로 가입된 계정이에요. ${label} 로그인을 이용해주세요.`,
      };
    }
    return { kind: "wrong_password", error: "비밀번호가 올바르지 않습니다." };
  }

  if (!data.user) {
    return { error: "로그인에 실패했습니다. 다시 시도해주세요." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    const params = new URLSearchParams({ redirect: redirectTo });
    redirect(`/signup/profile?${params.toString()}`);
  }

  redirect(redirectTo || "/");
}
