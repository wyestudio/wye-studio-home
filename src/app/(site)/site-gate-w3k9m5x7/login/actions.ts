"use server";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { signSiteGateToken, getSiteGateCookieOptions } from "@/lib/siteGateAuth";
import { getClientIp, checkRateLimit, recordFailure, recordSuccess } from "@/lib/loginRateLimit";

export async function verifySiteGatePassword(
  password: string
): Promise<{ error?: string }> {
  const expectedPassword = process.env.SITE_ACCESS_PASSWORD;

  if (!expectedPassword) {
    return { error: "사이트 게이트가 설정되지 않았습니다." };
  }

  const rateLimitKey = `site-gate:${await getClientIp()}`;
  const { blocked, retryAfterMs } = checkRateLimit(rateLimitKey);
  if (blocked) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `너무 많이 틀렸습니다. ${minutes}분 후 다시 시도해주세요.` };
  }

  // 타이밍 세이프 비교: 입력값과 정답을 모두 해싱 후 비교(admin 로그인과 동일 패턴)
  const inputHash = createHmac("sha256", "site-gate-password-hash-salt")
    .update(password || "")
    .digest("hex");
  const correctHash = createHmac("sha256", "site-gate-password-hash-salt")
    .update(expectedPassword)
    .digest("hex");

  let isValid = false;
  try {
    isValid = timingSafeEqual(Buffer.from(inputHash), Buffer.from(correctHash));
  } catch {
    isValid = false;
  }

  if (!isValid) {
    recordFailure(rateLimitKey);
    return { error: "비밀번호가 잘못됐습니다." };
  }

  recordSuccess(rateLimitKey);

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
