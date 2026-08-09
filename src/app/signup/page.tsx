// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 이 페이지는 더 이상
// 어디서도 링크되지 않음. 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/profile";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : "/";
  const prefillEmail = typeof params.email === "string" ? params.email : "";

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">회원가입</h1>
      <p className="mb-8 text-sm text-muted">
        wye studio는 참가자의 성별·연령 확인을 위해 회원가입 후 참가 신청을 받고 있어요.
      </p>
      <SignupForm redirectTo={redirectTo} prefillEmail={prefillEmail} />
    </div>
  );
}
