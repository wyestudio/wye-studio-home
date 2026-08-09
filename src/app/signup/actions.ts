"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccountByEmail } from "@/lib/accountLookup";

export type SignupState = {
  error?: string;
};

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }

  const supabase = await createClient();

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error) {
    if (error.message === "User already registered") {
      const admin = createAdminClient();
      const match = await findAccountByEmail(admin, email);
      if (match.status === "social_only") {
        const label = match.provider === "kakao" ? "카카오" : "네이버";
        return { error: `이미 ${label}로 가입된 이메일이에요. ${label} 로그인을 이용해주세요.` };
      }
      return { error: "이미 가입된 이메일이에요. 로그인 페이지에서 로그인해주세요." };
    }
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "회원가입에 실패했습니다. 다시 시도해주세요." };
  }

  // Confirm Email이 켜진 상태에서 이미 가입된(인증완료) 이메일로 signUp()을
  // 호출하면 에러를 던지지 않고 "가짜 성공" 응답을 준다(계정 열거 공격 방지용
  // Supabase 보안 기능) — identities가 빈 배열인 게 그 신호. 이 경우도 위의
  // "User already registered" 에러 케이스와 동일하게 처리해야 한다.
  if (data.user.identities && data.user.identities.length === 0) {
    const admin = createAdminClient();
    const match = await findAccountByEmail(admin, email);
    if (match.status === "social_only") {
      const label = match.provider === "kakao" ? "카카오" : "네이버";
      return { error: `이미 ${label}로 가입된 이메일이에요. ${label} 로그인을 이용해주세요.` };
    }
    return { error: "이미 가입된 이메일이에요. 로그인 페이지에서 로그인해주세요." };
  }

  // find_account_by_email RPC가 "진짜 비밀번호가 있는 계정"을 판별하는 유일한
  // 근거 — app_metadata는 client SDK가 못 건드리므로(service_role 전용)
  // 이메일 비밀번호 가입 성공 시에만 여기서 심어둔다.
  const admin = createAdminClient();
  const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { has_password: true },
  });
  if (metaError) {
    console.error(`[signup] app_metadata has_password flag failed: ${metaError.message}`);
  }

  // Confirm Email이 켜져 있어(supabase-schema.sql/CLAUDE.md 참고) signUp()은
  // 세션 없이 반환된다 — 이메일 인증 후 /auth/callback → finishOAuthLogin이
  // 이름/전화번호 등 추가 정보 입력 화면(/signup/profile)으로 자동 이동시킨다.
  if (data.session) {
    const params = new URLSearchParams({ redirect: redirectTo });
    redirect(`/signup/profile?${params.toString()}`);
  }
  redirect("/signup/check-email");
}
