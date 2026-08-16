import "server-only";
import { headers } from "next/headers";

// 서버리스 함수 프로세스 메모리에만 저장 — 재배포/콜드스타트 시 초기화되는
// 한계는 있지만("완벽한 영구 방어"는 별도 저장소 없이는 불가능), 지금까지
// 있던 "방어 전혀 없음" 상태보다는 훨씬 낫다.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type Entry = { count: number; lockedUntil: number | null };

const attempts = new Map<string, Entry>();

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

export function checkRateLimit(key: string): { blocked: boolean; retryAfterMs: number } {
  const entry = attempts.get(key);
  if (!entry?.lockedUntil) return { blocked: false, retryAfterMs: 0 };
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) return { blocked: false, retryAfterMs: 0 };
  return { blocked: true, retryAfterMs: remaining };
}

export function recordFailure(key: string): void {
  const entry = attempts.get(key) ?? { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
