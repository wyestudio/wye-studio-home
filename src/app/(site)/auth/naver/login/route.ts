import { startNaverAuth } from "@/lib/naver";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") ?? "/";
  return startNaverAuth("login", redirectTo, origin);
}
