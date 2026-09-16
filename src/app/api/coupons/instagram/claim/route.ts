import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCouponCode } from "@/lib/coupon";

/**
 * 인스타 댓글 이벤트 쿠폰 발급 — ManyChat 이 호출한다.
 *
 *   POST /api/coupons/instagram/claim
 *   Authorization: Bearer {MANYCHAT_WEBHOOK_SECRET}
 *   { "instagram_username": "someone", "campaign_key": "instagram_grand_open_202609" }
 *
 * 흐름: 이벤트 게시물 댓글 → ManyChat 이 DM → 사용자가 '쿠폰 받기' →
 *      팔로우 확인 → 여기를 호출 → 받은 코드를 DM 으로 보낸다.
 *
 * ⚠️ 새 쿠폰 체계를 만들지 않는다. 어드민에서 발급해 둔 「인스타 댓글 이벤트」
 *    캠페인의 미사용 코드를 한 장씩 배정할 뿐이다. 소진되면 더 찍어내지 않고
 *    SOLD_OUT_OR_ENDED 를 돌려준다 — 몇 장을 풀지는 사람이 정해야 한다.
 *
 * ⚠️ 배정의 멱등성·원자성은 전부 DB 함수(assign_coupon_to_handle)에 있다.
 *    여기서 "이미 받았나" 를 먼저 조회하고 없으면 배정하는 식으로 짜면,
 *    두 요청이 동시에 들어올 때 같은 계정에 두 장이 나간다.
 *
 * ⚠️ 로그에 아이디·코드·비밀키를 남기지 않는다. 실패 사유만 남긴다.
 */

/** 응답을 ManyChat 이 그대로 분기에 쓴다. 이름을 바꾸면 자동화가 깨진다. */
type ClaimResponse =
  | { success: true; coupon_code: string; already_issued: boolean }
  | { success: false; reason: string };

/** 길이가 달라도 타이밍이 새지 않게 비교한다. */
function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[instagram-claim] MANYCHAT_WEBHOOK_SECRET 미설정");
    return NextResponse.json<ClaimResponse>(
      { success: false, reason: "SERVER_NOT_CONFIGURED" },
      { status: 500 }
    );
  }

  // Authorization: Bearer … 또는 x-webhook-secret 헤더. ManyChat 설정 화면에 따라
  // 둘 중 편한 쪽을 쓰면 된다.
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const token = bearer || request.headers.get("x-webhook-secret") || "";

  if (!token || !secretMatches(token, expected)) {
    return NextResponse.json<ClaimResponse>(
      { success: false, reason: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let body: { instagram_username?: unknown; campaign_key?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ClaimResponse>(
      { success: false, reason: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const handle = typeof body.instagram_username === "string" ? body.instagram_username : "";
  const campaignKey = typeof body.campaign_key === "string" ? body.campaign_key : "";

  if (!handle.trim() || !campaignKey.trim()) {
    return NextResponse.json<ClaimResponse>(
      { success: false, reason: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    // 정규화(@ 제거·소문자)와 계정당 1장 보장은 DB 함수 안에 있다.
    const { data, error } = await supabase.rpc("assign_coupon_to_handle", {
      p_campaign_key: campaignKey.trim(),
      p_handle: handle,
    });

    if (error) {
      console.error("[instagram-claim] 배정 실패", error.message);
      return NextResponse.json<ClaimResponse>(
        { success: false, reason: "SERVER_ERROR" },
        { status: 500 }
      );
    }

    const r = data as { ok?: boolean; code?: string; reused?: boolean; reason?: string };

    if (!r?.ok) {
      // 소진·종료는 정상 흐름이다. ManyChat 이 안내 DM 으로 분기할 수 있게
      // 200 으로 돌려준다 — 4xx 면 ManyChat 이 오류로 처리해 분기가 어렵다.
      const reason = r?.reason ?? "SOLD_OUT_OR_ENDED";
      console.warn("[instagram-claim] 발급 불가:", reason);
      return NextResponse.json<ClaimResponse>({ success: false, reason }, { status: 200 });
    }

    return NextResponse.json<ClaimResponse>({
      success: true,
      // 사람이 옮겨 적기 쉽게 하이픈을 넣어 준다(E01Y-07TY).
      // 입력할 때는 하이픈이 있든 없든 인식된다.
      coupon_code: formatCouponCode(r.code ?? ""),
      already_issued: Boolean(r.reused),
    });
  } catch (err) {
    console.error("[instagram-claim] 예외", err instanceof Error ? err.message : err);
    return NextResponse.json<ClaimResponse>(
      { success: false, reason: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
