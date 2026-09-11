"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const birthYear = Number(formData.get("birthYear") ?? 0);
  const gender = String(formData.get("gender") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  // 성별은 선택 입력이다 (D-04). 생년월일 대신 출생연도만 받는다 (D-03).
  if (!name || !phone || !birthYear) {
    return { error: "이름·휴대폰 번호·출생연도를 입력해주세요." };
  }
  if (!/^01[016789]\d{7,8}$/.test(phone.replace(/\D/g, ""))) {
    return { error: "휴대폰 번호를 정확히 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 프로필 저장 + 과거 비회원 신청 자동 연결을 한 트랜잭션에서 한다.
  // 번호가 같은 과거 신청(본인이 대표로 낸 것만)이 계정에 붙는다.
  const { error } = await supabase.rpc("upsert_profile_and_link", {
    p_user_id: user.id,
    p_name: name,
    p_phone: phone,
    p_birth_year: birthYear,
    p_gender: gender || null,
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
