import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/profile";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : "/";
  const hasNaverError = params.error === "naver_login_failed";

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">로그인</h1>
      <p className="mb-8 text-sm text-muted">
        참가 신청을 하려면 먼저 로그인해주세요.
      </p>
      {hasNaverError ? (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          네이버 로그인에 실패했습니다. 다시 시도해주세요.
        </p>
      ) : null}
      <LoginForm redirectTo={redirectTo} />
      <p className="mt-6 text-center text-sm text-muted">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-semibold text-brand">
          회원가입
        </Link>
      </p>
    </div>
  );
}
