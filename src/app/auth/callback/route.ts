import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishOAuthLogin } from "@/lib/profile";

// Handles both the email "confirm your address" link (signup) and the Kakao
// OAuth redirect (Supabase's native connector) — both hand us a `code` to
// exchange for a session. Naver uses its own /auth/naver/callback instead,
// since it's a fully custom OAuth flow, not one Supabase manages.
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
