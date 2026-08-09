"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdult, MIN_SIGNUP_AGE } from "@/lib/age";
import { isDuplicatePhoneError, resolveDuplicatePhoneConflict } from "@/lib/profile";
import { PENDING_LINK_COOKIE, pendingLinkCookieOptions } from "@/lib/oauthLink";

export type ProfileState = {
  error?: string;
};

export async function completeProfileAction(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "");
  const gender = String(formData.get("gender") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!name || !phone || !birthDate || !gender) {
    return { error: "모든 항목을 입력해주세요." };
  }
  if (gender !== "M" && gender !== "F") {
    return { error: "성별을 선택해주세요." };
  }
  if (!isAdult(birthDate)) {
    return { error: `wye studio는 만 ${MIN_SIGNUP_AGE}세 이상만 이용할 수 있습니다.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    name,
    phone,
    birth_date: birthDate,
    gender,
  });

  if (error) {
    if (isDuplicatePhoneError(error)) {
      const admin = createAdminClient();
      const outcome = await resolveDuplicatePhoneConflict(
        admin,
        user,
        phone.replace(/\D/g, ""),
        redirectTo
      );
      if (outcome.kind === "link_offer") {
        const cookieStore = await cookies();
        cookieStore.set(PENDING_LINK_COOKIE, JSON.stringify(outcome.pendingLink), pendingLinkCookieOptions());
        redirect("/login/confirm-link");
      }
      // 이미 (프로필 없는) 세션이 만들어져 있어 로그아웃하지 않으면 /login이
      // "로그인된 사용자는 홈으로" 가드에 걸려 안내를 못 보고 바로 튕겨나간다.
      await supabase.auth.signOut();
      const params = new URLSearchParams({ notice: "phone_conflict" });
      if (outcome.provider) params.set("provider", outcome.provider);
      redirect(`/login?${params.toString()}`);
    }
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  redirect(redirectTo || "/");
}
