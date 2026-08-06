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

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_session_stats", { p_session_id: sessionId })
    .single();

  if (error) throw error;
  return data as SessionStats;
}
