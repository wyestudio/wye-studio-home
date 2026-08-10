import { ProcessSteps } from "@/components/contents/ProcessSteps";
import { SessionCard } from "@/components/home/SessionCard";
import { getUpcomingSessions } from "@/lib/sessions";

export default async function ContentsPage() {
  const sessions = await getUpcomingSessions();

  return (
    <div className="pt-10">
      <h1 className="mb-3 text-center text-2xl font-extrabold">Contents</h1>
      <ProcessSteps />
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="mb-6 text-center text-xl font-extrabold">지금 열린 회차</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </div>
    </div>
  );
}
