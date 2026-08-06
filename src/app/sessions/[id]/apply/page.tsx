import { notFound, redirect } from "next/navigation";
import { getSessionById } from "@/lib/sessions";
import { getCurrentUser, getMyProfile } from "@/lib/profile";
import { getMyApplicationForSession } from "@/lib/applications";
import { ApplyForm } from "@/components/apply/ApplyForm";
import { ApplyComplete } from "@/components/apply/ApplyComplete";
import { formatSessionDateTime } from "@/lib/format";

export default async function ApplyPage({ params }: PageProps<"/sessions/[id]/apply">) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/sessions/${id}/apply`)}`);
  }

  const profile = await getMyProfile();
  if (!profile) {
    redirect(`/signup/profile?redirect=${encodeURIComponent(`/sessions/${id}/apply`)}`);
  }

  const existing = await getMyApplicationForSession(id);

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">참가 신청</h1>
      <p className="mb-6 text-sm text-muted">
        {session.title} · {formatSessionDateTime(session.start_at)}
      </p>

      {existing ? (
        <ApplyComplete application={existing} priceKrw={session.price_krw} />
      ) : session.status === "closed" ? (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          이 회차는 모집이 마감되었습니다.
        </p>
      ) : (
        <ApplyForm sessionId={id} priceKrw={session.price_krw} profile={profile} />
      )}
    </div>
  );
}
