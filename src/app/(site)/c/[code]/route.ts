import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeCouponCode } from "@/lib/coupon";

/**
 * 쿠폰 링크 — /c/{코드}
 *
 * 문자로 나가는 링크가 여기로 온다. 화면을 그리지 않고 코드를 쿠키에 담은 뒤
 * 테마 페이지로 넘긴다.
 *
 * 왜 쿼리 파라미터(?coupon=CODE)가 아닌가:
 *   · 주소창에 코드가 그대로 남아 고객이 URL 을 공유하면 자기 쿠폰이 같이 넘어간다
 *   · GA4 에 페이지 주소로 쌓여 분석 데이터에 쿠폰 코드가 남는다
 *   · 지인 쿠폰은 애초에 전달용이라 URL 이 여기저기 돌아다닌다
 *   Shopify 도 같은 이유로 ?discount= 방식을 폐기하고 /discount/CODE 로 갔다.
 *
 * ⚠️ 여기서 쿠폰의 유효성을 판정하지 않는다. 담아서 넘기기만 한다.
 *    이미 쓴 쿠폰인지 만료됐는지는 신청 화면에서 안내해야 고객이 맥락을 안다.
 */

/** 신청 화면이 읽어가는 쿠폰 쿠키. httpOnly 가 아니어야 클라이언트 폼이 초기값으로 쓴다. */
export const COUPON_COOKIE = "wye_coupon";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = normalizeCouponCode(code);

  // 어디로 보낼지: 쿠폰이 특정 테마 전용이면 그 테마, 아니면 노출 중인 테마.
  let destination = "/contents";
  try {
    const supabase = await createClient();
    const { data: themes } = await supabase
      .from("themes")
      .select("slug")
      .eq("is_listed", true)
      .order("sort_order")
      .limit(1);
    if (themes?.[0]?.slug) destination = `/themes/${themes[0].slug}`;
  } catch {
    // 조회에 실패해도 링크는 살아야 한다. 목록 페이지로 떨어진다.
  }

  const response = NextResponse.redirect(
    new URL(destination, process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wouldyouescape.com")
  );

  if (normalized) {
    response.cookies.set(COUPON_COOKIE, normalized, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일. 문자를 받고 나중에 들어와도 유지된다.
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
