import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishOAuthLogin } from "@/lib/profile";

// Handles the email "confirm your address" link (signup) — exchanges the
// `code` it hands us for a session. Kakao and Naver both use their own
// custom /auth/{provider}/callback instead (see src/lib/kakao.ts,
// src/lib/naver.ts) since neither goes through Supabase's OAuth system.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      return finishOAuthLogin(supabase, data.user, redirectTo, origin);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
