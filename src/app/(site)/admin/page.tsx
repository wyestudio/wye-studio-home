import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSessionDateTime } from "@/lib/format";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { CopyUrlButton } from "@/components/admin/CopyUrlButton";
import { getSessionStats } from "@/lib/sessions";
import { formatCapacityLine, formatHeadcountLine } from "@/lib/sessionStatsFormat";
import type { Session, SessionStats } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createAdminClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
    .order("start_at", { ascending: false });

  if (sessionsError) {
    return (
      <div className="p-6">
        <div className="text-red-500">세션 목록을 불러올 수 없습니다: {sessionsError.message}</div>
      </div>
    );
  }

  const statsBySessionId = new Map<string, SessionStats>();
  await Promise.all(
    (sessions ?? []).map(async (session: Session) => {
      try {
        statsBySessionId.set(session.id, await getSessionStats(session.id));
      } catch (err) {
        console.error(`[admin] 세션 통계 조회 실패: ${session.id}`, err);
      }
    })
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">관리자 대시보드</h1>
            <p className="text-muted">세션별 신청 현황을 확인하고 입금을 승인할 수 있습니다.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/sms-templates"
              className="px-3 py-2 text-sm bg-glow text-glow-foreground rounded hover:opacity-90 transition-opacity"
            >
              문자 포맷 관리
            </Link>
            <Link
              href="/analytics"
              className="px-3 py-2 text-sm bg-glow text-glow-foreground rounded hover:opacity-90 transition-opacity"
            >
              분석 보기
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="space-y-4">
          {sessions && sessions.length > 0 ? (
            sessions.map((session) => {
              const stats = statsBySessionId.get(session.id);
              return (
                <Link
                  key={session.id}
                  href={`/admin/sessions/${session.id}`}
                  className="block p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-foreground truncate">
                        {session.session_type} {session.theme_name}
                      </h2>
                      <p className="text-sm text-muted mt-1">{formatSessionDateTime(session.start_at)}</p>
                      <p className="text-xs text-muted mt-1">{formatCapacityLine(session)}</p>
                      {stats && <p className="text-xs text-muted mt-1">{formatHeadcountLine(stats)}</p>}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <div className="text-sm font-medium">
                        상태:{" "}
                        <span className={session.status === "cancelled" ? "text-red-500" : "text-glow"}>
                          {session.status === "open" ? "모집중" : session.status === "cancelled" ? "비활성화" : "마감"}
                        </span>
                      </div>
                      <CopyUrlButton url={`${process.env.NEXT_PUBLIC_SITE_URL || "https://wouldyouescape.com"}/sessions/${session.slug}`} />
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted">
              등록된 세션이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
