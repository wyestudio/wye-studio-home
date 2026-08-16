import { SessionShowcase } from "@/components/home/SessionShowcase";
import type { Session } from "@/types/domain";

export function ContentsSessionShowcase({ sessions }: { sessions: Session[] }) {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-6 pb-10 sm:max-w-3xl sm:px-8 sm:pt-8 sm:pb-14 lg:max-w-4xl lg:pt-10 lg:pb-20">
      <h1 className="mb-4 text-center text-xl font-extrabold sm:mb-6 sm:text-2xl">Contents</h1>
      <SessionShowcase sessions={sessions} compact />
    </div>
  );
}
