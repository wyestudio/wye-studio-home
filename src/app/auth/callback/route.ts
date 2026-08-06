import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase OAuth callback. Not wired to any provider yet (Kakao/Naver keys
// aren't issued), but the route exists so enabling a provider later only
// requires flipping it on in Supabase Auth settings — no routing changes.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile) {
        const params = new URLSearchParams({ redirect: redirectTo });
        return NextResponse.redirect(`${origin}/signup/profile?${params.toString()}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
