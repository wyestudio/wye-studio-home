import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/profile";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : "/";

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">로그인</h1>
      <p className="mb-8 text-sm text-muted">
        참가 신청을 하려면 먼저 로그인해주세요.
      </p>
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
