import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { verifyAdminToken } from "@/lib/adminAuth";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인 시스템은 더 이상
// 활성 플로우에서 쓰이지 않음. 삭제하지 않고 보존 — 결제 연동 등으로 계정이 다시
// 필요해지면 참고. 자세한 배경은 CLAUDE.md "설계 변경 이력" 참고.
// sessions/*/apply는 이제 로그인 없이 누구나 접근 가능해야 해서 가드에서 제외했다.
const PROTECTED_PATTERN = /^\/(account|auth\/(naver|kakao)\/link)/;

function isAdminProtectedPath(pathname: string): boolean {
  const adminPath = process.env.ADMIN_PATH || "/admin-x7f9k2m3";
  // 어드민 경로 중에서 /login 제외
  const adminRegex = new RegExp(`^${adminPath}(?!/login$)`);
  return adminRegex.test(pathname);
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  if (PROTECTED_PATTERN.test(request.nextUrl.pathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Session refresh already handled by updateSession above.
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 어드민 경로 보호 (서명된 토큰 검증)
  if (isAdminProtectedPath(request.nextUrl.pathname)) {
    const adminCookie = request.cookies.get("admin_auth")?.value;
    if (!adminCookie || !verifyAdminToken(adminCookie)) {
      const adminPath = process.env.ADMIN_PATH || "/admin-x7f9k2m3";
      const loginUrl = new URL(`${adminPath}/login`, request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
