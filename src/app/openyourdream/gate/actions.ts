"use server";

import { cookies } from "next/headers";
import {
  isCorrectGateCode,
  signGateToken,
  getGateCookieName,
  getGateCookieOptions,
} from "@/lib/openYourDreamGateAuth";
import { getClientIp, checkRateLimit, recordFailure, recordSuccess } from "@/lib/loginRateLimit";

export async function verifyGateCode(code: string): Promise<{ error?: string }> {
  const rateLimitKey = `oyd-gate:${await getClientIp()}`;
  const { blocked, retryAfterMs } = checkRateLimit(rateLimitKey);
  if (blocked) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { error: `너무 많이 틀렸습니다. ${minutes}분 후 다시 시도해주세요.` };
  }

  if (!/^\d{8}$/.test(code)) {
    return { error: "숫자 8자리를 모두 입력해주세요." };
  }

  if (!isCorrectGateCode(code)) {
    recordFailure(rateLimitKey);
    return { error: "번호가 일치하지 않습니다." };
  }

  recordSuccess(rateLimitKey);

  try {
    const token = signGateToken();
    const cookieStore = await cookies();
    cookieStore.set(getGateCookieName(), token, getGateCookieOptions());
    return {};
  } catch (err) {
    console.error("[openyourdream-gate] 토큰 발급 오류", err);
    return { error: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }
}
