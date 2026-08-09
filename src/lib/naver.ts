import { NextResponse } from "next/server";

const NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize";
const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me";

export const NAVER_STATE_COOKIE = "naver_oauth_state";

export type NaverAuthState = {
  state: string;
  redirect: string;
  mode: "login" | "link";
};

// Shared by /auth/naver/login (new session) and /auth/naver/link (attach to
// the currently logged-in user) — same OAuth handshake, the callback route
// branches on `mode` to decide what to do with the result.
export function startNaverAuth(
  mode: NaverAuthState["mode"],
  redirectTo: string,
  origin: string
): NextResponse {
  const state = crypto.randomUUID();
  const redirectUri = `${origin}/auth/naver/callback`;

  const response = NextResponse.redirect(getNaverAuthorizeUrl(state, redirectUri));
  const cookieValue: NaverAuthState = { state, redirect: redirectTo, mode };
  response.cookies.set(NAVER_STATE_COOKIE, JSON.stringify(cookieValue), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}

export function getNaverAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NAVER_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
  });
  return `${NAVER_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeNaverCode(
  code: string,
  state: string,
  redirectUri: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NAVER_CLIENT_ID!,
    client_secret: process.env.NAVER_CLIENT_SECRET!,
    code,
    state,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${NAVER_TOKEN_URL}?${params.toString()}`);
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(`네이버 토큰 교환 실패: ${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token;
}

export interface NaverProfile {
  naverId: string;
  email: string | null;
  name: string | null;
  gender: string | null; // "M" | "F" | "U"
  birthday: string | null; // "MM-DD"
  birthyear: string | null; // "YYYY"
  mobile: string | null;
}

// 네이버 응답이 { resultcode, message, response: { id, email, ... } } 형태로
// 중첩돼 있어서(표준 OIDC userinfo와 다름) 여기서 풀어서 정규화한다.
export async function fetchNaverProfile(accessToken: string): Promise<NaverProfile> {
  const res = await fetch(NAVER_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    resultcode: string;
    message: string;
    response?: {
      id: string;
      email?: string;
      name?: string;
      gender?: string;
      birthday?: string;
      birthyear?: string;
      mobile?: string;
    };
  };

  if (!res.ok || data.resultcode !== "00" || !data.response) {
    throw new Error(`네이버 프로필 조회 실패: ${data.message ?? res.status}`);
  }

  const r = data.response;
  return {
    naverId: r.id,
    email: r.email ?? null,
    name: r.name ?? null,
    gender: r.gender ?? null,
    birthday: r.birthday ?? null,
    birthyear: r.birthyear ?? null,
    mobile: r.mobile ?? null,
  };
}
