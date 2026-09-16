import { NextResponse } from "next/server";

/**
 * 인스타 댓글 이벤트 홍보용 짧은 주소 — /open-event
 *
 * 인스타 프로필·게시물에 넣는 링크다. 긴 utm 주소를 그대로 노출하면
 *   · 글자수를 잡아먹고 눈에 지저분하며
 *   · 손님이 주소를 복사해 공유할 때 utm 이 같이 퍼져 유입 분석이 흐려진다
 * 그래서 짧은 주소를 두고 여기서 utm 을 붙여 넘긴다.
 *
 * ⚠️ 리다이렉트 기준은 반드시 **요청 URL** 이다. 환경변수를 base 로 쓰면
 *    테스트에서 누른 링크가 운영 사이트로 넘어간다(/c/[code] 에서 실제로 겪었다).
 *
 * ⚠️ 목적지 테마(baotalchul)와 캠페인 이름을 일부러 박아 둔다.
 *    이 주소는 "2026-09-26 인스타 쿠폰 이벤트" 한 건을 가리키는 홍보 링크이고,
 *    analytics 의 utm_campaign 으로 성과를 묶어 보기 때문에 값이 흔들리면 안 된다.
 *    ⚠️ 테마 slug 를 바꾸면 여기도 같이 고쳐야 한다. 안 고치면 404 로 떨어진다.
 */
const DESTINATION =
  "/themes/baotalchul" +
  "?utm_source=instagram&utm_medium=social&utm_campaign=coupon_event_0926";

export function GET(request: Request) {
  // 307(임시) — 캠페인이 끝나면 목적지를 바꾸거나 없앨 수 있어야 한다.
  // 308(영구)로 두면 브라우저가 캐시해 나중에 바꿔도 옛 주소로 간다.
  return NextResponse.redirect(new URL(DESTINATION, request.url), 307);
}
