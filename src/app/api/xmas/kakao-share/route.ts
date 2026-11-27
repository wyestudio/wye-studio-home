import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { XMAS_SHARE_ARG } from "@/components/xmas-game/xmasGameShared";

/**
 * 카카오톡 공유 웹훅 — 크리스마스 게임의 「친구에게 공유하고 재도전」(2026-11-27 대표님).
 *
 * 손님이 카카오톡 공유로 메시지를 **실제로 대화방에 보냈을 때만** 카카오가 이 주소를 부른다(열기만 하고 닫으면 안 온다).
 * 공유할 때 실어 보낸 표 번호(serverCallbackArgs 의 XMAS_SHARE_ARG)와 대화방 종류 · 대화방 값을 DB 에 적는다.
 * 인정할지(나와의 채팅 · 이 브라우저가 전에 보낸 방은 아니다)는 DB 함수 xmas_game_share_confirm 이 정한다.
 *
 * - 카카오 디벨로퍼스 > 앱 > 카카오톡 공유 > 웹훅 에 이 주소를 적는다. 카카오는 `Authorization: KakaoAK {어드민 키}` 를
 *   붙여 보낸다 — 그 값이 우리 어드민 키(KAKAO_ADMIN_KEY)와 같을 때만 받는다(아무나 "보냈다" 고 부를 수 없게).
 * - 카카오는 3초 안에 2xx 를 받지 못하면 다시 보낸다. DB 한 번만 부르고 바로 답한다. 같은 알림이 다시 와도 DB 가 처음 값을 지킨다.
 * - 값은 GET 이면 주소에, POST 면 본문(JSON 또는 폼)에 온다 — 둘 다 읽는다.
 * - 서버가 도는 것은 손님이 실제로 보낸 횟수만큼이다(wye-server-cost).
 */
export const dynamic = "force-dynamic";

async function readParams(request: NextRequest): Promise<Record<string, string>> {
  const params: Record<string, string> = Object.fromEntries(request.nextUrl.searchParams);
  if (request.method !== "POST") return params;
  try {
    const text = await request.text();
    if (!text) return params;
    if (text.trimStart().startsWith("{")) {
      const json = JSON.parse(text) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) if (v != null) params[k] = String(v);
    } else {
      for (const [k, v] of new URLSearchParams(text)) params[k] = v;
    }
  } catch {
    // 읽지 못하면 주소의 값만 쓴다
  }
  return params;
}

async function handle(request: NextRequest) {
  const adminKey = process.env.KAKAO_ADMIN_KEY;
  if (!adminKey || request.headers.get("authorization") !== `KakaoAK ${adminKey}`) {
    return new NextResponse(null, { status: 401 });
  }
  const params = await readParams(request);
  const token = params[XMAS_SHARE_ARG];
  // 다른 공유(게임과 상관없는 것)도 같은 웹훅으로 올 수 있다 — 표 번호가 없으면 받기만 하고 끝낸다
  if (token) {
    const { error } = await createAdminClient().rpc("xmas_game_share_confirm", {
      p_token: token,
      p_chat_type: params.CHAT_TYPE ?? null,
      p_chat_hash: params.HASH_CHAT_ID ?? null,
    });
    // 실패하면 5xx 로 답해 카카오가 다시 보내게 한다
    if (error) return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}

export const GET = handle;
export const POST = handle;
