import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProfileFromSignupMetadata } from "@/lib/profile";

// Handles both the email "confirm your address" link (signup) and, later,
// the Kakao/Naver OAuth redirect — both hand us a `code` to exchange for a
// session. The route exists now so enabling a social provider later only
// requires flipping it on in Supabase Auth settings, no routing changes.
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
        // Email/password signups stash name/phone/birth_date/gender in
        // user_metadata so we can finish the profile here without making
        // the user retype it. OAuth logins (no such metadata yet) fall
        // through to the manual form.
        const completed = await createProfileFromSignupMetadata(supabase, data.user);
        if (!completed) {
          const params = new URLSearchParams({ redirect: redirectTo });
          return NextResponse.redirect(`${origin}/signup/profile?${params.toString()}`);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
