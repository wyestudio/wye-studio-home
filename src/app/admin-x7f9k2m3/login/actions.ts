"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function verifyAdminPassword(password: string) {
  const correctPassword = process.env.ADMIN_PASSWORD;

  if (!correctPassword) {
    throw new Error("관리자 비밀번호가 설정되지 않았습니다.");
  }

  if (password !== correctPassword) {
    return { error: "비밀번호가 틀렸습니다." };
  }

  // 비밀번호 확인 완료, 쿠키 설정
  const cookieStore = await cookies();
  cookieStore.set("admin_auth", "verified", {
    maxAge: 24 * 60 * 60, // 24시간
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return { success: true };
}
