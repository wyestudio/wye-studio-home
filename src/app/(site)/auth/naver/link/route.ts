import { startNaverAuth } from "@/lib/naver";

// Requires login — proxy.ts guards this path. Kicks off the same Naver OAuth
// handshake as /auth/naver/login, but the callback route will attach the
// result to the current session's user instead of minting a new one.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/account";
  return startNaverAuth("link", redirectTo, origin);
}
