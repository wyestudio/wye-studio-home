import { NextResponse } from "next/server";
import { getNaverAuthorizeUrl } from "@/lib/naver";

const STATE_COOKIE = "naver_oauth_state";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/";
  const state = crypto.randomUUID();
  const redirectUri = `${origin}/auth/naver/callback`;

  const response = NextResponse.redirect(getNaverAuthorizeUrl(state, redirectUri));
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, redirect: redirectTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
