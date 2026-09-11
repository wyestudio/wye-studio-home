import "server-only";
import { cookies } from "next/headers";
import { requireAdminAuth } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 어드민 서버 액션의 공통 진입점.
 *
 * proxy.ts 가 이미 /admin/* 경로를 막고 있지만, 서버 액션은 경로가 아니라
 * 액션 ID 로 호출되므로 미들웨어를 거치지 않을 수 있다. 따라서 액션 안에서
 * 한 번 더 검증한다(다층 방어).
 *
 * @throws 인증 실패 시 Error
 */
export async function requireAdmin() {
  const cookieStore = await cookies();
  await requireAdminAuth(cookieStore.get("admin_auth")?.value);
  return createAdminClient();
}

/** 서버 액션 공통 결과. 판별은 항상 `"error" in res` 로 한다. */
export type ActionOk = { success: true; message?: string };
export type ActionErr = { error: string };
export type ActionResult = ActionOk | ActionErr;

/** 서버 액션에서 예외를 사용자에게 보여줄 메시지로 변환한다. */
export function toActionError(err: unknown, fallback: string): ActionErr {
  const message = err instanceof Error ? err.message : String(err);
  // DB 제약 위반은 원문이 길고 불친절해서 자주 나오는 것만 다듬는다.
  if (message.includes("duplicate key") && message.includes("slug")) {
    return { error: "이미 같은 slug 를 쓰는 항목이 있습니다." };
  }
  if (message.includes("themes_capacity_order")) {
    return { error: "즉시확정 인원은 정원보다 클 수 없습니다." };
  }
  if (message.includes("어드민 인증")) {
    return { error: "로그인이 만료되었습니다. 다시 로그인해주세요." };
  }
  console.error("[admin]", fallback, err);
  return { error: `${fallback}: ${message}` };
}
