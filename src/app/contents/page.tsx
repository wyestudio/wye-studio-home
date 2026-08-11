import { ProcessSteps } from "@/components/contents/ProcessSteps";
import { SessionCard } from "@/components/home/SessionCard";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function ContentsPage() {
  const sessions = await getUpcomingSessions();

  return (
    <div className="pt-10">
      <h1 className="mb-3 text-center text-2xl font-extrabold">Contents</h1>
      <p className="mx-auto mb-6 max-w-3xl px-5 text-center text-sm text-muted">
        이번 시즌은 2개 회차로 작게 시작해요. 반응을 보고 다음 회차를 준비할게요.
      </p>
      <ProcessSteps />
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="mb-6 text-center text-xl font-extrabold">지금 열린 회차</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted">
            <p className="font-semibold">다음 시즌 준비 중</p>
            <p>새로운 회차가 열리면 이 자리에 추가돼요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
