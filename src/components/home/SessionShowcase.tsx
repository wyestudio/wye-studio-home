import Image from "next/image";
import { SessionCard } from "@/components/home/SessionCard";
import type { Session } from "@/types/domain";

export function SessionShowcase({
  sessions,
  compact = false,
  dense = false,
}: {
  sessions: Session[];
  compact?: boolean;
  // 홈 스크롤스테이지처럼 뷰포트 높이가 고정된 곳에서 모바일 폭 총 높이를 줄여야 할 때 사용.
  dense?: boolean;
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:gap-8 lg:gap-10 ${dense ? "gap-3" : "gap-6"}`}>
      {/* 왼쪽: 포스터 */}
      <div className={`mx-auto sm:mx-0 sm:w-64 sm:flex-shrink-0 lg:w-80 ${dense ? "w-36" : "w-56"}`}>
        <div className="relative aspect-[4/5] overflow-hidden border border-glass-border bg-surface">
          <Image
            src="/bar-o-title.png"
            alt="우주이스케이프 바-오 탈출 테마 아트웍"
            fill
            className="object-contain"
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 256px, 224px"
          />
        </div>
      </div>

      {/* 오른쪽: 카드 리스트 — 항상 모바일 스타일 */}
      <div className={`flex flex-1 flex-col sm:gap-5 ${dense ? "gap-2" : "gap-4"}`}>
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} compact={compact} dense={dense} mobileLayout />
        ))}
      </div>
    </div>
  );
}
