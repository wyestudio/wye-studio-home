import "server-only";
import { createClient } from "@supabase/supabase-js";

// service_role bypasses RLS entirely — only import this from Route Handlers,
// never from a Server Component or anything that could end up client-side.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
