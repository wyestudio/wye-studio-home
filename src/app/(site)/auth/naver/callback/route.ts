import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeNaverCode,
  fetchNaverProfile,
  NAVER_STATE_COOKIE,
  type NaverAuthState,
} from "@/lib/naver";
import { finishOAuthLogin } from "@/lib/profile";
import { PENDING_LINK_COOKIE, pendingLinkCookieOptions, type PendingLink } from "@/lib/oauthLink";

function toBirthDate(birthyear: string | null, birthday: string | null): string | null {
  if (!birthyear || !birthday) return null;
  return `${birthyear}-${birthday}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const rawState = cookieStore.get(NAVER_STATE_COOKIE)?.value;
  cookieStore.delete(NAVER_STATE_COOKIE);

  const failTo = (path: string, reason: string) => {
    console.error(`[naver-callback] ${reason}`);
    return NextResponse.redirect(`${origin}${path}`);
  };

  if (!code || !state || !rawState) {
    return failTo("/login?error=naver_login_failed", "missing code/state/cookie");
  }

  let saved: NaverAuthState;
  try {
    saved = JSON.parse(rawState);
  } catch {
    return failTo("/login?error=naver_login_failed", "bad state cookie json");
  }
  // state must round-trip through Naver unchanged — a mismatch means this
  // isn't a response to the request we just issued (CSRF).
  if (saved.state !== state) return failTo("/login?error=naver_login_failed", "state mismatch");

  const mode = saved.mode ?? "login";
  const fail = (reason: string) =>
    failTo(mode === "link" ? "/account?error=naver_link_failed" : "/login?error=naver_login_failed", reason);

  try {
    const redirectUri = `${origin}/auth/naver/callback`;
    const accessToken = await exchangeNaverCode(code, state, redirectUri);
    const naverProfile = await fetchNaverProfile(accessToken);
    const admin = createAdminClient();

    if (mode === "link") {
      // Attaching this Naver identity to whoever is currently logged in —
      // not minting a session. proxy.ts guards this route so there should
      // always be a user here.
      const supabase = await createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) return fail("not logged in for link request");

      const { data: existingLink } = await admin
        .from("naver_links")
        .select("user_id")
        .eq("naver_id", naverProfile.naverId)
        .maybeSingle();

      if (existingLink && existingLink.user_id !== currentUser.id) {
        return fail("naver account already linked to a different user");
      }
      if (!existingLink) {
        const { error: insertError } = await admin
          .from("naver_links")
          .insert({ naver_id: naverProfile.naverId, user_id: currentUser.id });
        if (insertError) return fail(`naver_links insert error: ${insertError.message}`);
      }
      return NextResponse.redirect(`${origin}${saved.redirect || "/account"}?linked=naver`);
    }

    // mode === "login"
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

    // If this Naver account was already linked to a user (via /account or a
    // prior login), go straight to that user's email — skips the createUser
    // round trip entirely and is correct even if the Naver-side email since
    // changed, since naver_id is the real identity here once linked.
    const { data: existingLink } = await admin
      .from("naver_links")
      .select("user_id")
      .eq("naver_id", naverProfile.naverId)
      .maybeSingle();

    let targetEmail = naverProfile.email;
    if (existingLink) {
      const { data: existingUser, error: getUserError } = await admin.auth.admin.getUserById(
        existingLink.user_id
      );
      if (getUserError || !existingUser.user?.email) {
        return fail(`getUserById error: ${getUserError?.message}`);
      }
      targetEmail = existingUser.user.email;
    } else {
      // First time seeing this email — known Supabase quirk: generateLink
      // (type:"magiclink") for an email with no user yet can race with its
      // own user-creation step, making the verifyOtp right after it fail
      // with "Email link is invalid or expired". Creating the user first
      // (idempotent — email_exists is fine) avoids it.
      const { error: createError } = await admin.auth.admin.createUser({
        email: naverProfile.email,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (createError) {
        if (createError.code === "email_exists") {
          // 이 네이버 계정과 처음 연결하는 시도인데, 이메일이 이미 다른
          // 방식으로 가입된 계정과 같다 — 조용히 그 계정으로 로그인/연결하지
          // 않고 사용자에게 먼저 확인받는다.
          const cookieStore = await cookies();
          cookieStore.set(
            PENDING_LINK_COOKIE,
            JSON.stringify({
              provider: "naver",
              providerId: naverProfile.naverId,
              email: naverProfile.email,
              metadata,
              redirect: saved.redirect,
            } satisfies PendingLink),
            pendingLinkCookieOptions()
          );
          return NextResponse.redirect(`${origin}/login/confirm-link`);
        }
        return fail(`createUser error: ${createError.message}`);
      }
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { data: metadata },
    });
    if (linkError || !linkData) return fail(`generateLink error: ${linkError?.message}`);

    const supabase = await createClient();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError || !verifyData.user) return fail(`verifyOtp error: ${verifyError?.message}`);

    // Record/refresh the naver_id ↔ user mapping so the next login skips
    // createUser and so this shows as "connected" on /account. Not on the
    // critical path — a failure here shouldn't block a login that already
    // succeeded.
    const { error: linkUpsertError } = await admin
      .from("naver_links")
      .upsert({ naver_id: naverProfile.naverId, user_id: verifyData.user.id }, { onConflict: "naver_id" });
    if (linkUpsertError) {
      console.error(`[naver-callback] naver_links upsert failed: ${linkUpsertError.message}`);
    }

    return finishOAuthLogin(supabase, verifyData.user, saved.redirect, origin);
  } catch (err) {
    return fail(`unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
