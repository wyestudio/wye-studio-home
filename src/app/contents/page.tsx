import { ProcessSteps } from "@/components/contents/ProcessSteps";
import { SessionCard } from "@/components/home/SessionCard";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function ContentsPage() {
  const sessions = await getUpcomingSessions();

  return (
    <div className="pt-16">
      <div className="mx-auto mb-16 max-w-3xl px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-glow">Contents</p>
        <h1 className="mt-2 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          지금 열린
          <br />
          회차
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted">
          이번 시즌은 2개 회차로 작게 시작해요. 반응을 보고 다음 회차를 준비할게요.
        </p>
      </div>

      <ProcessSteps />

      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-glass-border bg-surface/40 p-5 text-center text-sm text-muted">
            <p className="font-semibold">다음 시즌 준비 중</p>
            <p>새로운 회차가 열리면 이 자리에 추가돼요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
