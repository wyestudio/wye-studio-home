import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 광고 문자 대상·수신거부 목록 조회. 어드민 화면과 발송 액션이 같이 쓴다.
 *
 * ⚠️ "use server" 파일에 두지 않는다 — 거기서 export 한 함수는 인증 없이
 *    호출 가능한 서버 액션이 된다. 호출부가 requireAdmin() 을 거친 클라이언트를 넘긴다.
 */

export type MarketingRecipient = {
  phoneHash: string;
  name: string;
  phone: string;
  participationCount: number;
  lastSessionStart: string;
};

export type MarketingOptout = {
  phoneHash: string;
  phone: string;
  note: string | null;
  createdAt: string;
};

export async function fetchMarketingRecipients(supabase: SupabaseClient): Promise<MarketingRecipient[]> {
  const { data, error } = await supabase.rpc("marketing_sms_recipients");
  if (error) throw error;
  return (
    (data ?? []) as {
      phone_hash: string;
      name: string;
      phone: string;
      participation_count: number;
      last_session_start: string;
    }[]
  ).map((r) => ({
    phoneHash: r.phone_hash,
    name: r.name,
    phone: r.phone,
    participationCount: r.participation_count,
    lastSessionStart: r.last_session_start,
  }));
}

export async function fetchMarketingOptouts(supabase: SupabaseClient): Promise<MarketingOptout[]> {
  const { data, error } = await supabase.rpc("list_marketing_optouts");
  if (error) throw error;
  return (
    (data ?? []) as { phone_hash: string; phone: string; note: string | null; created_at: string }[]
  ).map((r) => ({ phoneHash: r.phone_hash, phone: r.phone, note: r.note, createdAt: r.created_at }));
}
