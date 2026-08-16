import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { verifyAdminToken } from "@/lib/adminAuth";
import { verifySiteGateToken } from "@/lib/siteGateAuth";
import { isProductionHost } from "@/lib/hosts";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인 시스템은 더 이상
// 활성 플로우에서 쓰이지 않음. 삭제하지 않고 보존 — 결제 연동 등으로 계정이 다시
// 필요해지면 참고. 자세한 배경은 CLAUDE.md "설계 변경 이력" 참고.
// sessions/*/apply는 이제 로그인 없이 누구나 접근 가능해야 해서 가드에서 제외했다.
const PROTECTED_PATTERN = /^\/(account|auth\/(naver|kakao)\/link)/;

const ADMIN_HOSTS = new Set([
  "admin.wouldyouescape.com",
  "test.admin.wouldyouescape.com",
  "admin.localhost:3000",
  "test.admin.localhost:3000",
]);

const SITE_GATE_PATH = process.env.SITE_GATE_PATH || "/site-gate-w3k9m5x7";
const ADMIN_PATH = process.env.ADMIN_PATH || "/admin";

function isAdminHost(host: string): boolean {
  return ADMIN_HOSTS.has(host);
}

function isAdminProtectedPath(pathname: string): boolean {
  const adminRegex = new RegExp(`^${ADMIN_PATH}(?!/login$)`);
  return adminRegex.test(pathname);
}

// 프로덕션이 아닌 호스트(admin/test 서브도메인, Vercel 프리뷰 등)에서 나가는 모든
// 응답에 색인 차단 헤더를 강제한다 — 인증 게이트를 우회해 접근 가능한 로그인
// 페이지 등이 실수로 검색에 노출되는 걸 막는 마지막 방어선.
function tagRobots(response: NextResponse, blockIndexing: boolean): NextResponse {
  if (blockIndexing) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const pathname = request.nextUrl.pathname;
  const onAdminHost = isAdminHost(host);
  const isApiPath = pathname.startsWith("/api/");
  const blockIndexing = !isProductionHost(host);

  // robots.txt는 어떤 게이트/리라이트도 타지 않고 항상 src/app/robots.ts로
  // 직행시킨다 — 그래야 크롤러가 admin/test 호스트에서도 실제 disallow 규칙을
  // 받아볼 수 있다 (로그인 리다이렉트로 가려지면 크롤러가 차단 여부를 알 수 없음).
  if (pathname === "/robots.txt") {
    return NextResponse.next();
  }

  // 0단계: admin 호스트가 아닌데 /admin으로 직접 접근 시 404
  if (!onAdminHost && new RegExp(`^${ADMIN_PATH}(/|$)`).test(pathname)) {
    return tagRobots(new NextResponse(null, { status: 404 }), blockIndexing);
  }

  // 1단계: 사이트 전체 비밀번호 게이트
  const sitePassword = process.env.SITE_ACCESS_PASSWORD;
  if (sitePassword && !isApiPath && !pathname.startsWith(SITE_GATE_PATH)) {
    const gateCookie = request.cookies.get("site_gate_auth")?.value;
    if (!gateCookie || !verifySiteGateToken(gateCookie)) {
      const loginUrl = new URL(`${SITE_GATE_PATH}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return tagRobots(NextResponse.redirect(loginUrl), blockIndexing);
    }
  }

  // 2단계: admin 호스트 → 내부 경로 rewrite 대상 계산
  // site-gate 로그인 경로는 제외해야 함 — 안 그러면 admin 호스트에서
  // "/site-gate.../login"이 "/admin/site-gate.../login"으로 감싸져
  // 보호된 어드민 경로로 오인되고, "/login"으로 튕겼다가 거기서 다시 site-gate가
  // 발동해 무한 리다이렉트 루프에 빠진다(SITE_ACCESS_PASSWORD가 설정된 test.admin.*
  // 호스트에서 실제로 재현됨).
  let effectivePathname = pathname;
  let needsRewrite = false;
  if (onAdminHost && !isApiPath && !pathname.startsWith(SITE_GATE_PATH) && !pathname.startsWith(ADMIN_PATH)) {
    effectivePathname = pathname === "/" ? ADMIN_PATH : `${ADMIN_PATH}${pathname}`;
    needsRewrite = true;
  }

  // 3단계: PROTECTED_PATTERN 및 admin 인증 체크 (effectivePathname 기준)
  let earlyResponse: NextResponse | null = null;

  if (PROTECTED_PATTERN.test(effectivePathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Session refresh already handled by updateSession below.
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      earlyResponse = NextResponse.redirect(loginUrl);
    }
  }

  if (!earlyResponse && isAdminProtectedPath(effectivePathname)) {
    const adminCookie = request.cookies.get("admin_auth")?.value;
    if (!adminCookie || !verifyAdminToken(adminCookie)) {
      const loginUrl = onAdminHost
        ? new URL("/login", request.url)
        : new URL(`${ADMIN_PATH}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      earlyResponse = NextResponse.redirect(loginUrl);
    }
  }

  if (earlyResponse) return tagRobots(earlyResponse, blockIndexing);

  // 4단계: 최종 응답 조립
  const sessionResponse = await updateSession(request);
  if (!needsRewrite) return tagRobots(sessionResponse, blockIndexing);

  const rewriteUrl = new URL(effectivePathname + request.nextUrl.search, request.url);
  const rewritten = NextResponse.rewrite(rewriteUrl, { request });
  // updateSession이 세팅한 쿠키를 rewrite 응답에 옮겨 담기
  sessionResponse.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
  return tagRobots(rewritten, blockIndexing);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
