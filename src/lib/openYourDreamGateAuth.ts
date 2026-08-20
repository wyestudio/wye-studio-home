import { createHmac, timingSafeEqual } from "crypto";

// 실물 명함(포스터)에 인쇄된 전화번호가 곧 정답 — env var로 빼지 않고 코드에
// 고정해둔다. env var로 관리하면 Vercel 배포 시 값 설정을 깜빡할 위험이 있고
// (이 프로젝트에서 실제로 반복된 실수), 이 게이트는 실물 카드를 가진 사람만
// 통과하면 되는 캐주얼한 이스터에그 수준 보안이라 하드코딩으로 충분하다.
const CORRECT_CODE = "43129573";

const COOKIE_NAME = "oyd_gate_auth";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1년(초 단위) — "한 번 통과하면 다시 안 물어보기"
const TOKEN_EXPIRE_MS = COOKIE_MAX_AGE * 1000;

function getHmacKey(): string {
  return createHmac("sha256", "oyd-gate-key-salt").update(CORRECT_CODE).digest("hex");
}

/**
 * 입력값(뒤 8자리)이 정답과 일치하는지 타이밍 세이프하게 비교
 */
export function isCorrectGateCode(input: string): boolean {
  const inputHash = createHmac("sha256", "oyd-gate-code-hash-salt")
    .update(input || "")
    .digest("hex");
  const correctHash = createHmac("sha256", "oyd-gate-code-hash-salt")
    .update(CORRECT_CODE)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(inputHash), Buffer.from(correctHash));
  } catch {
    return false;
  }
}

/**
 * 게이트 토큰 서명 및 발급
 * 형식: `{만료시각}.{HMAC서명}`
 */
export function signGateToken(): string {
  const expiresAt = Date.now() + TOKEN_EXPIRE_MS;
  const payload = expiresAt.toString();
  const signature = createHmac("sha256", getHmacKey()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/**
 * 게이트 토큰 검증 — 만료 시각 확인 + 서명 검증
 */
export function verifyGateToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payloadStr, signature] = parts;
    const expiresAt = parseInt(payloadStr, 10);
    if (Date.now() > expiresAt) return false;

    const expectedSignature = createHmac("sha256", getHmacKey()).update(payloadStr).digest("hex");
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

export function getGateCookieName(): string {
  return COOKIE_NAME;
}

export function getGateCookieOptions() {
  return {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
