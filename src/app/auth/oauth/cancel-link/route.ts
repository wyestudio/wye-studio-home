import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PENDING_LINK_COOKIE } from "@/lib/oauthLink";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_LINK_COOKIE);

  // 이메일 충돌 케이스는 이 시점에 세션이 아예 없어 아래는 no-op이지만,
  // 전화번호 충돌 케이스는 연결 제안 전에 이미 (프로필 없는) 세션이 만들어져
  // 있다 — 취소했는데 그 상태로 로그인된 채 남으면 /account 등에서 깨진다.
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(`${origin}/login`);
}
