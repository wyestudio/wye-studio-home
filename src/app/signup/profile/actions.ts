"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdult, MIN_SIGNUP_AGE } from "@/lib/age";

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
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  redirect(redirectTo || "/");
}
