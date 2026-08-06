import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/profile";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">회원가입</h1>
      <p className="mb-8 text-sm text-muted">
        wye studio는 참가자의 성별·연령 확인을 위해 회원가입 후 참가 신청을 받고 있어요.
      </p>
      <SignupForm />
    </div>
  );
}
