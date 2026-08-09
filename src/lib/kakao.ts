import { NextResponse } from "next/server";

const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me";

export const KAKAO_STATE_COOKIE = "kakao_oauth_state";

export type KakaoAuthState = {
  state: string;
  redirect: string;
  mode: "login" | "link";
};

// Mirrors src/lib/naver.ts's startNaverAuth — same reasoning: Supabase's
// native Kakao connector always requests account_email + profile_nickname +
// profile_image regardless of our consent config, so a direct OAuth flow
// requesting only account_email is the only way to get a consent screen
// that shows just email.
export function startKakaoAuth(
  mode: KakaoAuthState["mode"],
  redirectTo: string,
  origin: string
): NextResponse {
  const state = crypto.randomUUID();
  const redirectUri = `${origin}/auth/kakao/callback`;

  const response = NextResponse.redirect(getKakaoAuthorizeUrl(state, redirectUri));
  const cookieValue: KakaoAuthState = { state, redirect: redirectTo, mode };
  response.cookies.set(KAKAO_STATE_COOKIE, JSON.stringify(cookieValue), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}

export function getKakaoAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.KAKAO_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
    scope: "account_email",
  });
  return `${KAKAO_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeKakaoCode(code: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_CLIENT_ID!,
    client_secret: process.env.KAKAO_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(`카카오 토큰 교환 실패: ${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token;
}

export interface KakaoProfile {
  kakaoId: string;
  email: string | null;
}

// account_email 스코프만 요청하므로 kakao_account.email 외 다른 필드는
// 애초에 동의를 못 받아 응답에 없다.
export async function fetchKakaoProfile(accessToken: string): Promise<KakaoProfile> {
  const res = await fetch(KAKAO_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    id?: number;
    kakao_account?: { email?: string; is_email_verified?: boolean };
    msg?: string;
  };

  if (!res.ok || data.id === undefined) {
    throw new Error(`카카오 프로필 조회 실패: ${data.msg ?? res.status}`);
  }

  return {
    kakaoId: String(data.id),
    email: data.kakao_account?.email ?? null,
  };
}
