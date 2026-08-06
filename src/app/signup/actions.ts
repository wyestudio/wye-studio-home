"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdult, MIN_SIGNUP_AGE } from "@/lib/age";

export type SignupState = {
  error?: string;
};

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "");
  const gender = String(formData.get("gender") ?? "");

  if (!email || !password || !name || !phone || !birthDate || !gender) {
    return { error: "모든 항목을 입력해주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }
  if (gender !== "M" && gender !== "F") {
    return { error: "성별을 선택해주세요." };
  }
  if (!isAdult(birthDate)) {
    return { error: `wye studio는 만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있습니다.` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message === "User already registered"
      ? "이미 가입된 이메일입니다."
      : error.message };
  }
  if (!data.user) {
    return { error: "회원가입에 실패했습니다. 다시 시도해주세요." };
  }

  if (!data.session) {
    redirect("/signup/check-email");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    name,
    phone,
    birth_date: birthDate,
    gender,
  });

  if (profileError) {
    return { error: `가입은 완료됐지만 추가정보 저장에 실패했습니다: ${profileError.message}` };
  }

  redirect("/");
}
