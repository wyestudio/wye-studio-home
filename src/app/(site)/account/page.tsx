import { redirect } from "next/navigation";
import { getCurrentUser, getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { LinkedAccounts } from "@/components/account/LinkedAccounts";
import { MyApplications } from "@/components/account/MyApplications";

// 참여 이력은 로그인한 사람마다 다르므로 매번 새로 읽는다.
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account");

  const params = await searchParams;
  const linkError = params.error === "naver_link_failed" || params.error === "kakao_link_failed";
  const linkSuccess = params.linked === "naver" || params.linked === "kakao";

  const [profile, supabase] = await Promise.all([getMyProfile(), createClient()]);
  const [{ data: naverLink }, { data: kakaoLink }, { data: myApps }] = await Promise.all([
    supabase.from("naver_links").select("naver_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("kakao_links").select("kakao_id").eq("user_id", user.id).maybeSingle(),
    // 본인 것만 돌려주는 RPC. user_id 를 파라미터로 받지 않는 이유는,
    // 받는 순간 남의 id 를 넣어 남의 이력을 볼 수 있기 때문이다.
    supabase.rpc("my_applications"),
  ]);

  const hasEmail = (user.identities ?? []).some((i) => i.provider === "email");
  const hasKakao = !!kakaoLink;
  const hasNaver = !!naverLink;

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">계정 설정</h1>
      <p className="mb-8 text-sm text-muted">
        참여 이력을 확인하고 로그인 수단을 관리하세요.
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
            {profile.birth_year ? (
              <div className="flex justify-between">
                <dt className="text-muted">출생연도</dt>
                <dd>{profile.birth_year}년</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div className="mb-6">
        <MyApplications applications={(myApps ?? []) as never[]} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted">연결된 로그인 수단</h2>
        <LinkedAccounts hasEmail={hasEmail} hasKakao={hasKakao} hasNaver={hasNaver} />
      </div>
    </div>
  );
}
