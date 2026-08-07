import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeNaverCode, fetchNaverProfile } from "@/lib/naver";
import { finishOAuthLogin } from "@/lib/profile";

const STATE_COOKIE = "naver_oauth_state";

function toBirthDate(birthyear: string | null, birthday: string | null): string | null {
  if (!birthyear || !birthday) return null;
  return `${birthyear}-${birthday}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const rawState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const fail = (reason: string) => {
    console.error(`[naver-callback] ${reason}`);
    return NextResponse.redirect(`${origin}/login?error=naver_login_failed`);
  };

  if (!code || !state || !rawState) return fail("missing code/state/cookie");

  let saved: { state: string; redirect: string };
  try {
    saved = JSON.parse(rawState);
  } catch {
    return fail("bad state cookie json");
  }
  // state must round-trip through Naver unchanged — a mismatch means this
  // isn't a response to the request we just issued (CSRF).
  if (saved.state !== state) return fail("state mismatch");

  try {
    const redirectUri = `${origin}/auth/naver/callback`;
    const accessToken = await exchangeNaverCode(code, state, redirectUri);
    const naverProfile = await fetchNaverProfile(accessToken);

    // email is a required consent item in the Naver app config, so this
    // should always be present — but our whole auth model needs an email,
    // so bail out loudly rather than guessing one.
    if (!naverProfile.email) return fail("naver profile has no email");

    const metadata: Record<string, string> = { naver_id: naverProfile.naverId };
    if (naverProfile.name) metadata.name = naverProfile.name;
    if (naverProfile.mobile) metadata.phone = naverProfile.mobile;
    const birthDate = toBirthDate(naverProfile.birthyear, naverProfile.birthday);
    if (birthDate) metadata.birth_date = birthDate;
    if (naverProfile.gender === "M" || naverProfile.gender === "F") {
      metadata.gender = naverProfile.gender;
    }

    // service_role only: mints a session for this email without a password.
    // The email must come from our own server-side call to Naver above —
    // never from anything the client could supply.
    const admin = createAdminClient();

    // Known Supabase quirk: generateLink(type:"magiclink") for an email that
    // doesn't have a user yet can race with its own user-creation step, so the
    // verifyOtp right after it fails with "Email link is invalid or expired".
    // Creating the user first (idempotent — email_exists is fine) avoids it.
    const { error: createError } = await admin.auth.admin.createUser({
      email: naverProfile.email,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (createError && createError.code !== "email_exists") {
      return fail(`createUser error: ${createError.message}`);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: naverProfile.email,
      options: { data: metadata },
    });
    if (linkError || !linkData) return fail(`generateLink error: ${linkError?.message}`);

    const supabase = await createClient();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !verifyData.user) return fail(`verifyOtp error: ${verifyError?.message}`);

    return finishOAuthLogin(supabase, verifyData.user, saved.redirect, origin);
  } catch (err) {
    return fail(`unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
