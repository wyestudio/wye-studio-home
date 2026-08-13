"use server";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { signAdminToken, getAdminCookieOptions } from "@/lib/adminAuth";

export async function verifyAdminPassword(password: string) {
  const correctPassword = process.env.ADMIN_PASSWORD;

  if (!correctPassword) {
    throw new Error("관리자 비밀번호가 설정되지 않았습니다.");
  }

  // 타이밍 세이프 비교: 입력값과 정답을 모두 해싱 후 비교
  const inputHash = createHmac("sha256", "password-hash-salt")
    .update(password)
    .digest("hex");
  const correctHash = createHmac("sha256", "password-hash-salt")
    .update(correctPassword)
    .digest("hex");

  let isValid = false;
  try {
    isValid = timingSafeEqual(Buffer.from(inputHash), Buffer.from(correctHash));
  } catch {
    isValid = false;
  }

  if (!isValid) {
    // 브루트포스 방어: 틀린 비밀번호는 1초 지연
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "비밀번호가 틀렸습니다." };
  }

  // 비밀번호 확인 완료, 서명된 토큰 발급
  const cookieStore = await cookies();
  const token = signAdminToken();
  cookieStore.set("admin_auth", token, getAdminCookieOptions());

  return { success: true };
}

export async function logoutAdmin() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete("admin_auth");
}
