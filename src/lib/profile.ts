// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 이 로그인 시스템은
// 더 이상 활성 플로우에서 쓰이지 않음. 삭제하지 않고 보존 — 결제 연동 등으로
// 계정이 다시 필요해지면 참고. 자세한 배경은 CLAUDE.md "설계 변경 이력" 참고.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdult } from "@/lib/age";
import { findAccountByPhoneDigits } from "@/lib/accountLookup";
import { PENDING_LINK_COOKIE, pendingLinkCookieOptions, type PendingLink } from "@/lib/oauthLink";
import type { Profile } from "@/types/domain";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

// profiles.phone_digits has a unique index (정규화된 전화번호 기준 중복 가입 방지).
// A 23505 on that constraint means a DIFFERENT person's profile already has
// this phone number — distinct from a 23505 on the id column, which just
// means this user's own profile already exists (idempotent, not an error).
// PostgREST의 실제 응답에서는 error.details가 null로 오는 경우가 있어(실측
// 확인됨) details만 믿을 수 없다 — error.message에는 항상 제약조건 이름
// (profiles_phone_digits_key)이 들어있으므로 함께 확인한다.
export function isDuplicatePhoneError(
  error: { code?: string; details?: string | null; message?: string } | null
): boolean {
  if (!error || error.code !== "23505") return false;
  return !!error.details?.includes("phone_digits") || !!error.message?.includes("phone_digits");
}

export type ProfileCreationResult =
  | { status: "created" }
  | { status: "incomplete_metadata" }
  | { status: "duplicate_phone"; phoneDigits: string };

/**
 * signupAction stores the signup form's name/phone/birth_date/gender in the
 * auth user's metadata so it survives the "confirm your email" round trip
 * (which can happen on a different request, even a different device). Call
 * this right after a user's first authenticated request post-confirmation
 * (e.g. /auth/callback) to finish creating their profile without asking them
 * to type everything again.
 */
export async function createProfileFromSignupMetadata(
  supabase: SupabaseClient,
  user: User
): Promise<ProfileCreationResult> {
  const meta = user.user_metadata as Record<string, unknown>;
  const name = typeof meta.name === "string" ? meta.name : "";
  const phone = typeof meta.phone === "string" ? meta.phone : "";
  const birthDate = typeof meta.birth_date === "string" ? meta.birth_date : "";
  const gender = typeof meta.gender === "string" ? meta.gender : "";

  if (!name || !phone || !birthDate || (gender !== "M" && gender !== "F")) {
    return { status: "incomplete_metadata" };
  }
  if (!isAdult(birthDate)) {
    return { status: "incomplete_metadata" };
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    name,
    phone,
    birth_date: birthDate,
    gender,
  });

  if (!error) return { status: "created" };
  if (isDuplicatePhoneError(error)) {
    return { status: "duplicate_phone", phoneDigits: phone.replace(/\D/g, "") };
  }
  // 23505 on id = this user's own profile already exists — idempotent success.
  if (error.code === "23505") return { status: "created" };
  return { status: "incomplete_metadata" };
}

// 현재 세션이 카카오/네이버 연결을 가지고 있는지 확인한다 — "방금 실제
// OAuth로 신원이 검증됐는지"를 가리는 기준으로 쓰인다. 이메일/비번으로 막
// 가입한 사람은 여기 해당하지 않는다(기존 계정 소유를 증명할 방법이 없음).
async function getProviderLinkForUser(
  admin: SupabaseClient,
  userId: string
): Promise<{ provider: "kakao" | "naver"; providerId: string } | null> {
  const [{ data: kakao }, { data: naver }] = await Promise.all([
    admin.from("kakao_links").select("kakao_id").eq("user_id", userId).maybeSingle(),
    admin.from("naver_links").select("naver_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (kakao) return { provider: "kakao", providerId: kakao.kakao_id as string };
  if (naver) return { provider: "naver", providerId: naver.naver_id as string };
  return null;
}

export type DuplicatePhoneOutcome =
  | { kind: "link_offer"; pendingLink: PendingLink }
  | { kind: "notice"; provider: "kakao" | "naver" | null };

/**
 * 전화번호가 이미 다른 계정에 등록돼 있을 때 무엇을 할지 결정한다.
 * finishOAuthLogin(카카오/네이버 신규 가입 중 전화번호 충돌)과
 * completeProfileAction(/signup/profile에서 직접 입력한 전화번호가 충돌) 둘 다
 * 재사용한다. 현재 사용자가 방금 실제 OAuth 인증을 거친 경우(카카오/네이버
 * 연결이 있는 경우)에만 연결을 제안하고, 그렇지 않으면(이메일/비번 신규가입)
 * 기존 계정 소유를 증명할 방법이 없으므로 안내만 한다.
 */
export async function resolveDuplicatePhoneConflict(
  admin: SupabaseClient,
  currentUser: User,
  phoneDigits: string,
  redirectTo: string
): Promise<DuplicatePhoneOutcome> {
  const match = await findAccountByPhoneDigits(admin, phoneDigits);

  if (match && match.userId !== currentUser.id) {
    const currentLink = await getProviderLinkForUser(admin, currentUser.id);
    if (currentLink) {
      const { data: targetUser } = await admin.auth.admin.getUserById(match.userId);
      if (targetUser.user?.email) {
        return {
          kind: "link_offer",
          pendingLink: {
            provider: currentLink.provider,
            providerId: currentLink.providerId,
            email: targetUser.user.email,
            metadata: (currentUser.user_metadata as Record<string, string>) ?? {},
            redirect: redirectTo,
            matchedBy: "phone",
          },
        };
      }
    }
  }
  return { kind: "notice", provider: match?.provider ?? null };
}

/**
 * Shared by every OAuth/email callback route once a Supabase session exists:
 * finish creating the profile from signup metadata if possible, otherwise
 * send the user to fill it in manually (or, if the phone belongs to a
 * different existing account, offer to link or notify accordingly).
 */
export async function finishOAuthLogin(
  supabase: SupabaseClient,
  user: User,
  redirectTo: string,
  origin: string
): Promise<NextResponse> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const result = await createProfileFromSignupMetadata(supabase, user);
    if (result.status === "duplicate_phone") {
      const admin = createAdminClient();
      const outcome = await resolveDuplicatePhoneConflict(admin, user, result.phoneDigits, redirectTo);
      if (outcome.kind === "link_offer") {
        const cookieStore = await cookies();
        cookieStore.set(PENDING_LINK_COOKIE, JSON.stringify(outcome.pendingLink), pendingLinkCookieOptions());
        return NextResponse.redirect(`${origin}/login/confirm-link`);
      }
      // 연결을 제안하지 않는 경우 로그인 페이지로 보내는데, 이 시점엔 이미
      // (프로필 없는) 세션이 만들어져 있어 로그아웃하지 않으면 /login이
      // "로그인된 사용자는 홈으로" 가드에 걸려 안내 메시지를 못 보고 바로
      // 튕겨나간다 — 실제로 테스트하다 발견한 버그.
      await supabase.auth.signOut();
      const url = new URL(`${origin}/login`);
      url.searchParams.set("notice", "phone_conflict");
      if (outcome.provider) url.searchParams.set("provider", outcome.provider);
      return NextResponse.redirect(url);
    }
    if (result.status === "incomplete_metadata") {
      const params = new URLSearchParams({ redirect: redirectTo });
      return NextResponse.redirect(`${origin}/signup/profile?${params.toString()}`);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
