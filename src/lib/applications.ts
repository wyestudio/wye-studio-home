import { createClient } from "@/lib/supabase/server";
import type { Application } from "@/types/domain";

export async function getMyApplicationForSession(sessionId: string): Promise<Application | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}
