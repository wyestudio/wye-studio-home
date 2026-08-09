import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeKakaoCode,
  fetchKakaoProfile,
  KAKAO_STATE_COOKIE,
  type KakaoAuthState,
} from "@/lib/kakao";
import { finishOAuthLogin } from "@/lib/profile";
import { PENDING_LINK_COOKIE, pendingLinkCookieOptions, type PendingLink } from "@/lib/oauthLink";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const rawState = cookieStore.get(KAKAO_STATE_COOKIE)?.value;
  cookieStore.delete(KAKAO_STATE_COOKIE);

  const failTo = (path: string, reason: string) => {
    console.error(`[kakao-callback] ${reason}`);
    return NextResponse.redirect(`${origin}${path}`);
  };

  if (!code || !state || !rawState) {
    return failTo("/login?error=kakao_login_failed", "missing code/state/cookie");
  }

  let saved: KakaoAuthState;
  try {
    saved = JSON.parse(rawState);
  } catch {
    return failTo("/login?error=kakao_login_failed", "bad state cookie json");
  }
  // state must round-trip through Kakao unchanged — a mismatch means this
  // isn't a response to the request we just issued (CSRF).
  if (saved.state !== state) return failTo("/login?error=kakao_login_failed", "state mismatch");

  const mode = saved.mode ?? "login";
  const fail = (reason: string) =>
    failTo(mode === "link" ? "/account?error=kakao_link_failed" : "/login?error=kakao_login_failed", reason);

  try {
    const redirectUri = `${origin}/auth/kakao/callback`;
    const accessToken = await exchangeKakaoCode(code, redirectUri);
    const kakaoProfile = await fetchKakaoProfile(accessToken);
    const admin = createAdminClient();

    if (mode === "link") {
      // Attaching this Kakao identity to whoever is currently logged in —
      // not minting a session. proxy.ts guards this route so there should
      // always be a user here.
      const supabase = await createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) return fail("not logged in for link request");

      const { data: existingLink } = await admin
        .from("kakao_links")
        .select("user_id")
        .eq("kakao_id", kakaoProfile.kakaoId)
        .maybeSingle();

      if (existingLink && existingLink.user_id !== currentUser.id) {
        return fail("kakao account already linked to a different user");
      }
      if (!existingLink) {
        const { error: insertError } = await admin
          .from("kakao_links")
          .insert({ kakao_id: kakaoProfile.kakaoId, user_id: currentUser.id });
        if (insertError) return fail(`kakao_links insert error: ${insertError.message}`);
      }
      return NextResponse.redirect(`${origin}${saved.redirect || "/account"}?linked=kakao`);
    }

    // mode === "login"
    if (!kakaoProfile.email) return fail("kakao profile has no email");

    const metadata: Record<string, string> = { kakao_id: kakaoProfile.kakaoId };

    // If this Kakao account was already linked to a user (via /account or a
    // prior login), go straight to that user's email — skips the createUser
    // round trip and stays correct even if the Kakao-side email changes.
    const { data: existingLink } = await admin
      .from("kakao_links")
      .select("user_id")
      .eq("kakao_id", kakaoProfile.kakaoId)
      .maybeSingle();

    let targetEmail = kakaoProfile.email;
    if (existingLink) {
      const { data: existingUser, error: getUserError } = await admin.auth.admin.getUserById(
        existingLink.user_id
      );
      if (getUserError || !existingUser.user?.email) {
        return fail(`getUserById error: ${getUserError?.message}`);
      }
      targetEmail = existingUser.user.email;
    } else {
      // First time seeing this email — same Supabase quirk as Naver's flow:
      // generateLink(type:"magiclink") for a brand-new email can race with
      // its own user-creation step, making the following verifyOtp fail
      // with "Email link is invalid or expired". Creating the user first
      // (idempotent — email_exists is fine) avoids it.
      const { error: createError } = await admin.auth.admin.createUser({
        email: kakaoProfile.email,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (createError) {
        if (createError.code === "email_exists") {
          // 이 카카오 계정과 처음 연결하는 시도인데, 이메일이 이미 다른
          // 방식으로 가입된 계정과 같다 — 조용히 그 계정으로 로그인/연결하지
          // 않고 사용자에게 먼저 확인받는다.
          const cookieStore = await cookies();
          cookieStore.set(
            PENDING_LINK_COOKIE,
            JSON.stringify({
              provider: "kakao",
              providerId: kakaoProfile.kakaoId,
              email: kakaoProfile.email,
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

    // Record/refresh the kakao_id ↔ user mapping so the next login skips
    // createUser and so this shows as "connected" on /account.
    const { error: linkUpsertError } = await admin
      .from("kakao_links")
      .upsert({ kakao_id: kakaoProfile.kakaoId, user_id: verifyData.user.id }, { onConflict: "kakao_id" });
    if (linkUpsertError) {
      console.error(`[kakao-callback] kakao_links upsert failed: ${linkUpsertError.message}`);
    }

    return finishOAuthLogin(supabase, verifyData.user, saved.redirect, origin);
  } catch (err) {
    return fail(`unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
