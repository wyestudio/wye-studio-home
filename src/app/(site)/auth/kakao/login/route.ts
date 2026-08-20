import { startKakaoAuth } from "@/lib/kakao";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/";
  return startKakaoAuth("login", redirectTo, origin);
}
