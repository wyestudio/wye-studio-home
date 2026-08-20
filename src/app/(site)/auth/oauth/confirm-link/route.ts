import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finishOAuthLogin } from "@/lib/profile";
import { PENDING_LINK_COOKIE, type PendingLink } from "@/lib/oauthLink";

// 사용자가 "/login/confirm-link"에서 "연결하고 로그인하기"를 눌렀을 때만
// 여기 도달한다 — 콜백에서 잠깐 담아둔 pending link를 실제로 완료한다.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_LINK_COOKIE)?.value;
  cookieStore.delete(PENDING_LINK_COOKIE);

  const fail = (reason: string) => {
    console.error(`[oauth-confirm-link] ${reason}`);
    return NextResponse.redirect(`${origin}/login?error=link_confirm_failed`);
  };

  if (!raw) return fail("missing pending link cookie");

  let pending: PendingLink;
  try {
    pending = JSON.parse(raw);
  } catch {
    return fail("bad pending link cookie json");
  }

  const supabase = await createClient();

  // 전화번호 충돌로 여기 온 경우, 이 시점의 세션은 방금 만들어진 placeholder
  // 계정(카카오/네이버 ID는 있지만 프로필은 없는)이다. 아래에서 기존 계정으로
  // 세션을 바꾸고 나면 이 placeholder는 더 이상 쓸모가 없는데, 지우지 않고
  // 남겨두면 이 계정이 자기 이메일을 계속 붙들고 있다가 나중에 같은 이메일로
  // 다시 로그인 시도할 때 진짜 계정 대신 이 빈 계정으로 잘못 매칭되는 문제가
  // 생긴다(실제로 겪은 버그). 이메일 충돌로 온 경우는 이 시점에 세션이 아예
  // 없어(createUser 자체가 실패했으므로) 아래는 자연스럽게 no-op이다.
  const {
    data: { user: placeholderUser },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: pending.email,
    options: { data: pending.metadata },
  });
  if (linkError || !linkData) return fail(`generateLink error: ${linkError?.message}`);

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verifyData.user) return fail(`verifyOtp error: ${verifyError?.message}`);

  const table = pending.provider === "kakao" ? "kakao_links" : "naver_links";
  const idField = pending.provider === "kakao" ? "kakao_id" : "naver_id";
  const { error: linkUpsertError } = await admin
    .from(table)
    .upsert({ [idField]: pending.providerId, user_id: verifyData.user.id }, { onConflict: idField });
  if (linkUpsertError) {
    console.error(`[oauth-confirm-link] ${table} upsert failed: ${linkUpsertError.message}`);
  }

  if (placeholderUser && placeholderUser.id !== verifyData.user.id) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(placeholderUser.id);
    if (deleteError) {
      console.error(
        `[oauth-confirm-link] failed to delete orphaned placeholder ${placeholderUser.id}: ${deleteError.message}`
      );
    }
  }

  return finishOAuthLogin(supabase, verifyData.user, pending.redirect, origin);
}
