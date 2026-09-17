import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { resolveShortLink } from "@/lib/shortLinks";

/**
 * 어드민에서 만든 짧은 주소를 UTM 링크로 넘긴다.
 *
 * 왜 최상위가 아니라 /go/ 인가
 *   처음엔 /open-event 처럼 최상위에 두려 했다. 그런데 최상위에 동적 라우트를 두면
 *   **실제 페이지가 없는 모든 한 칸짜리 경로를 이 라우트가 차지한다.**
 *   실제 라우팅은 정적 라우트가 우선이라 문제가 없지만,
 *   - 앞으로 최상위 페이지를 추가할 때마다 짧은 주소와 겹치는지 신경 써야 하고
 *   - next 린트(no-html-link-for-pages)가 auth 라우트 핸들러로 가는 <a> 를
 *     "페이지니까 <Link> 를 써라" 로 오탐했다(2026-09-17). 그 <a> 는 프리페치되면
 *     OAuth 연결이 클릭 전에 실행될 수 있어 <Link> 로 바꾸면 안 되는 자리다.
 *   짧은 주소는 새로 만드는 것이라 아직 밖에 뿌린 게 없으므로, 이름 공간을 좁혀 둔다.
 *
 * ⚠️ 이미 배포된 /open-event 와 *.go 13개는 여기로 오지 않는다. next.config 의
 *    redirects() 와 open-event/route.ts 가 먼저 잡는다. 외부에 뿌린 주소를 DB
 *    조회에 의존시킬 이유가 없어 일부러 그대로 뒀다 — 어드민 목록에는 '코드 고정'
 *    으로 보인다.
 *
 * ⚠️ 나중에 최상위로 옮기려면, 실제 페이지가 있는 경로를 막는 예약어 목록을
 *    다시 만들어야 한다. 저장은 되는데 동작은 안 하는 상태가 제일 나쁘다.
 *
 * ⚠️ 307(임시)을 쓴다. 308 로 두면 브라우저가 목적지를 캐시해, 이벤트가 끝나
 *    목적지를 바꿔도 예전 곳으로 계속 간다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let destination: string | null = null;
  try {
    destination = await resolveShortLink(slug);
  } catch (err) {
    // 목록을 못 읽었다고 404 를 주면, 살아 있는 짧은 주소가 조용히 죽는다.
    // 무엇이 실패했는지 로그로 남긴다(주소는 공개 정보라 남겨도 된다).
    console.error(`[shortLink] '${slug}' 해석 실패`, err);
    notFound();
  }

  if (!destination) notFound();

  // 목적지는 요청 URL 기준으로 만든다. 환경변수 기준 주소를 쓰면 미리보기
  // 배포에서 누른 링크가 운영 도메인으로 넘어가 테스트 유입이 운영 통계에 섞인다.
  return NextResponse.redirect(new URL(destination, request.url), 307);
}
