import { createClient } from "@/lib/supabase/server";
import type { Session, SessionStats } from "@/types/domain";

export async function getUpcomingSessions(): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getSessionById(id: string): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSessionBySlug(slug: string): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_session_stats", { p_session_id: sessionId })
    .single();

  if (error) throw error;
  return data as SessionStats;
}

// 홈/Contents 회차 카드의 "마감임박" 리본 판정용 — 각 회차에 공개 집계(stats)를 붙여서 반환.
// 개별 회차 조회 실패는 카드 표시를 막을 정도의 문제가 아니므로 stats: null로 넘어간다.
export async function attachSessionStats<T extends Session>(
  sessions: T[]
): Promise<(T & { stats: SessionStats | null })[]> {
  const supabase = await createClient();
  return Promise.all(
    sessions.map(async (session) => {
      const { data, error } = await supabase
        .rpc("get_session_stats", { p_session_id: session.id })
        .single();
      return { ...session, stats: error ? null : (data as SessionStats) };
    })
  );
}
