import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "admin_auth";
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24시간 (초 단위)
const TOKEN_EXPIRE_MS = COOKIE_MAX_AGE * 1000;

function getHmacKey(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
  // 비밀번호를 SHA-256으로 해싱해서 HMAC 키로 사용
  // 비밀번호가 바뀌면 이 키도 바뀌어서 기존 서명이 모두 무효화됨
  return createHmac("sha256", "admin-key-salt")
    .update(password)
    .digest("hex");
}

/**
 * 어드민 토큰 서명 및 발급
 * 형식: `{만료시각}.{HMAC서명}`
 */
export function signAdminToken(): string {
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
 * 어드민 토큰 검증
 * 만료 시각 확인 + 서명 검증
 * @returns true if valid, false otherwise
 */
export function verifyAdminToken(token: string): boolean {
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

    // timingSafeEqual로 비교 (타이밍 공격 방어)
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * 쿠키 이름 반환 (재사용성)
 */
export function getAdminCookieName(): string {
  return COOKIE_NAME;
}

/**
 * 쿠키 설정값 반환 (로그인 시 사용)
 */
export function getAdminCookieOptions() {
  return {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * 서버 액션/라우트에서 인증 검증 (다층 방어)
 * @throws Error if not authenticated
 */
export async function requireAdminAuth(cookieValue?: string) {
  if (!cookieValue || !verifyAdminToken(cookieValue)) {
    throw new Error("어드민 인증이 필요합니다.");
  }
}
