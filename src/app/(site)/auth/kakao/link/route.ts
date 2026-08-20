import { startKakaoAuth } from "@/lib/kakao";

// Requires login — proxy.ts guards this path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/account";
  return startKakaoAuth("link", redirectTo, origin);
}
