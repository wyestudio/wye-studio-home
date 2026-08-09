import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailAccountLookup =
  | { status: "not_found" }
  | { status: "social_only"; provider: "kakao" | "naver" }
  | { status: "has_password" };

// find_account_by_email/find_account_by_phone는 auth.users를 직접 조회하는
// SECURITY DEFINER RPC(supabase-schema.sql 9번 섹션) — service_role에서만
// 호출 가능. admin.listUsers()는 이메일 필터를 지원하지 않아 이 방식을 쓴다.
export async function findAccountByEmail(
  admin: SupabaseClient,
  email: string
): Promise<EmailAccountLookup> {
  const { data, error } = await admin.rpc("find_account_by_email", { p_email: email });
  if (error) {
    console.error(`[accountLookup] find_account_by_email failed: ${error.message}`);
    return { status: "not_found" }; // 실패 시 "미가입"으로 처리 — 절대 통과시키지 않음
  }
  const row = data?.[0] as
    | { user_id: string; has_password: boolean; provider: "kakao" | "naver" | null }
    | undefined;
  if (!row) return { status: "not_found" };
  if (!row.has_password && row.provider) return { status: "social_only", provider: row.provider };
  return { status: "has_password" };
}

export type PhoneAccountLookup = { userId: string; provider: "kakao" | "naver" | null } | null;

export async function findAccountByPhoneDigits(
  admin: SupabaseClient,
  phoneDigits: string
): Promise<PhoneAccountLookup> {
  const { data, error } = await admin.rpc("find_account_by_phone", { p_phone_digits: phoneDigits });
  if (error) {
    console.error(`[accountLookup] find_account_by_phone failed: ${error.message}`);
    return null;
  }
  const row = data?.[0] as { user_id: string; provider: "kakao" | "naver" | null } | undefined;
  return row ? { userId: row.user_id, provider: row.provider } : null;
}
