import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getSessionStats } from "@/lib/sessions";
import { formatKrw, formatSessionDateTime } from "@/lib/format";
import type { Session } from "@/types/domain";

export async function SessionCard({ session }: { session: Session }) {
  const stats = await getSessionStats(session.id);
  const total = stats.confirmed_count + stats.waiting_count;

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-brand">{session.theme_label}</span>
        {session.status === "closed" ? (
          <Badge tone="danger">마감</Badge>
        ) : (
          <Badge tone="neutral">모집중</Badge>
        )}
      </div>
      <h3 className="text-lg font-extrabold">{session.title}</h3>
      <p className="text-sm text-muted">
        {formatSessionDateTime(session.start_at)} · {session.venue_area}
      </p>
      <p className="text-sm font-semibold">{formatKrw(session.price_krw)} / 인당</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
          방탈출 1회 플레이
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
          {session.theme_label === "소개팅" ? "성비 맞춤 매칭" : "4인 1조 랜덤 편성"}
        </span>
      </div>

      <div className="mt-1">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>
            신청 {total} / 목표 {session.capacity_confirm_line}명
          </span>
          {session.theme_label === "소개팅" ? (
            <span>
              확정 남 {stats.male_confirmed_count}/{session.capacity_confirm_line_male ?? 0} · 여{" "}
              {stats.female_confirmed_count}/{session.capacity_confirm_line_female ?? 0}
            </span>
          ) : (
            <span>
              확정 {stats.confirmed_count}명
              {stats.waiting_count > 0 ? ` · 대기 ${stats.waiting_count}명` : ""}
            </span>
          )}
        </div>
        <ProgressBar value={total} max={session.capacity_max} />
      </div>
    </Link>
  );
}
