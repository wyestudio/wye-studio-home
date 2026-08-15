"use server";

import { cookies } from "next/headers";
import { signSiteGateToken, getSiteGateCookieOptions } from "@/lib/siteGateAuth";

export async function verifySiteGatePassword(
  password: string
): Promise<{ error?: string }> {
  const expectedPassword = process.env.SITE_ACCESS_PASSWORD;

  if (!expectedPassword) {
    return { error: "사이트 게이트가 설정되지 않았습니다." };
  }

  if (!password || password !== expectedPassword) {
    return { error: "비밀번호가 잘못됐습니다." };
  }

  try {
    const token = signSiteGateToken();
    const cookieStore = await cookies();
    cookieStore.set("site_gate_auth", token, getSiteGateCookieOptions());
    return {};
  } catch (err) {
    console.error("[site-gate] 토큰 발급 오류", err);
    return { error: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }
}

export async function logoutSiteGate() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("site_gate_auth");
  } catch (err) {
    console.error("[site-gate] 로그아웃 오류", err);
  }
}
