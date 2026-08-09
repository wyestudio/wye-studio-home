// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 이 페이지는 더 이상
// 어디서도 링크되지 않음. 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/profile";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : "/";

  let notice: string | null = null;
  if (params.error === "naver_login_failed") {
    notice = "네이버 로그인에 실패했습니다. 다시 시도해주세요.";
  } else if (params.error === "kakao_login_failed") {
    notice = "카카오 로그인에 실패했습니다. 다시 시도해주세요.";
  } else if (params.notice === "already_registered") {
    notice =
      "이미 가입된 계정이 있어요. 기존에 사용하신 방법으로 로그인해주세요. 로그인 후 계정 설정에서 다른 로그인 수단을 연결할 수 있어요.";
  } else if (params.error === "link_confirm_failed") {
    notice = "계정 연결에 실패했어요. 다시 시도해주세요.";
  } else if (params.notice === "phone_conflict") {
    const provider = params.provider;
    const label = provider === "kakao" ? "카카오" : provider === "naver" ? "네이버" : null;
    notice = label
      ? `입력하신 휴대폰 번호는 이미 ${label} 계정으로 가입되어 있어요. ${label} 로그인을 이용해주세요.`
      : "이미 가입된 휴대폰 번호예요. 기존에 사용하신 방법으로 로그인해주세요.";
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">로그인</h1>
      <p className="mb-8 text-sm text-muted">
        참가 신청을 하려면 먼저 로그인해주세요.
      </p>
      {notice ? (
        <p className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {notice}
        </p>
      ) : null}
      <LoginForm redirectTo={redirectTo} />
      <p className="mt-6 text-center text-sm text-muted">
        아직 계정이 없으신가요?{" "}
        <Link
          href={`/signup?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-brand"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}
