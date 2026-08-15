import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "site_gate_auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30일 (초 단위, 내부용이라 로그인 마찰 최소화)
const TOKEN_EXPIRE_MS = COOKIE_MAX_AGE * 1000;

function getHmacKey(): string {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) {
    throw new Error("SITE_ACCESS_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
  return createHmac("sha256", "site-gate-key-salt")
    .update(password)
    .digest("hex");
}

/**
 * 사이트 게이트 토큰 서명 및 발급
 * 형식: `{만료시각}.{HMAC서명}`
 */
export function signSiteGateToken(): string {
  const now = Date.now();
  const expiresAt = now + TOKEN_EXPIRE_MS;
  const hmacKey = getHmacKey();

  const payload = expiresAt.toString();
  const signature = createHmac("sha256", hmacKey)
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

/**
 * 사이트 게이트 토큰 검증
 * 만료 시각 확인 + 서명 검증
 * @returns true if valid, false otherwise
 */
export function verifySiteGateToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return false;
    }

    const [payloadStr, signature] = parts;
    const expiresAt = parseInt(payloadStr, 10);

    // 만료 확인
    if (Date.now() > expiresAt) {
      return false;
    }

    // 서명 검증 (타이밍 세이프)
    const hmacKey = getHmacKey();
    const expectedSignature = createHmac("sha256", hmacKey)
      .update(payloadStr)
      .digest("hex");

    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * 쿠키 이름 반환
 */
export function getSiteGateCookieName(): string {
  return COOKIE_NAME;
}

/**
 * 쿠키 설정값 반환
 */
export function getSiteGateCookieOptions() {
  return {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
