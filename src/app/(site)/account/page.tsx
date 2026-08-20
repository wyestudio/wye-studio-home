import { redirect } from "next/navigation";
import { getCurrentUser, getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { LinkedAccounts } from "@/components/account/LinkedAccounts";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account");

  const params = await searchParams;
  const linkError = params.error === "naver_link_failed" || params.error === "kakao_link_failed";
  const linkSuccess = params.linked === "naver" || params.linked === "kakao";

  const [profile, supabase] = await Promise.all([getMyProfile(), createClient()]);
  const [{ data: naverLink }, { data: kakaoLink }] = await Promise.all([
    supabase.from("naver_links").select("naver_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("kakao_links").select("kakao_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const hasEmail = (user.identities ?? []).some((i) => i.provider === "email");
  const hasKakao = !!kakaoLink;
  const hasNaver = !!naverLink;

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">계정 설정</h1>
      <p className="mb-8 text-sm text-muted">
        로그인 수단을 관리하고 프로필 정보를 확인하세요.
      </p>

      {linkSuccess ? (
        <p className="mb-4 rounded-lg bg-confirm-soft px-4 py-3 text-sm text-confirm">
          연결이 완료됐어요.
        </p>
      ) : null}
      {linkError ? (
        <p className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          연결에 실패했어요. 이미 다른 계정에 연결된 수단일 수 있어요.
        </p>
      ) : null}

      {profile ? (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-muted">내 정보</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">이름</dt>
              <dd>{profile.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">전화번호</dt>
              <dd>{profile.phone}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted">연결된 로그인 수단</h2>
        <LinkedAccounts hasEmail={hasEmail} hasKakao={hasKakao} hasNaver={hasNaver} />
      </div>
    </div>
  );
}
