import { redirect } from "next/navigation";
import { getCurrentUser, getMyProfile } from "@/lib/profile";
import { ProfileDetailsForm } from "@/components/auth/ProfileDetailsForm";

export default async function ProfileCompletionPage({
  searchParams,
}: PageProps<"/signup/profile">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getMyProfile();
  if (profile) redirect("/");

  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : "/";

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 text-2xl font-extrabold">추가 정보 입력</h1>
      <p className="mb-8 text-sm text-muted">
        이름·연락처·출생연도를 한 번만 등록해주세요. 다음 신청부터 자동으로 채워집니다.
      </p>
      <ProfileDetailsForm redirectTo={redirectTo} />
    </div>
  );
}
