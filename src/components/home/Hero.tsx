import { SessionCard } from "@/components/home/SessionCard";
import type { Session } from "@/types/domain";

export function Hero({ sessions }: { sessions: Session[] }) {
  return (
    <section className="bg-gradient-to-b from-brand-soft to-background px-5 py-14 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          방탈출로 시작하는 자연스러운 만남
        </h1>
        <p className="mt-3 text-muted">
          매번 다른 파티룸을 대관해, 4인 1조로 랜덤 편성된 사람들과 방탈출을 함께 플레이합니다.
        </p>
      </div>

      <div id="sessions" className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </section>
  );
}
