import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSessionDateTime } from "@/lib/format";
import { AdminNav } from "@/components/admin/AdminNav";
import { CopyUrlButton } from "@/components/admin/CopyUrlButton";
import { getSessionStats } from "@/lib/sessions";
import { formatCapacityLine, formatHeadcountLine, countUnpaidConfirmed } from "@/lib/sessionStatsFormat";
import type { Session, SessionStats } from "@/types/domain";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다. */
function getNowMs(): number {
  return Date.now();
}

/**
 * 어드민 대시보드.
 *
 * 지표보다 "지금 내가 뭘 해야 하나"(처리 대기)를 위에 둔다.
 * 매주 운영에서 실제로 필요한 건 그것이기 때문이다.
 * 설계 근거: docs/08-architecture-screens-and-admin.md §3-3
 */
export default async function AdminDashboard() {
  const supabase = createAdminClient();

  const [sessionsRes, appsRes, attendeesRes, unmatchedRes] = await Promise.all([
    supabase.from("sessions").select("*").order("start_at", { ascending: false }),
    supabase
      .from("admin_application_view")
      .select("id, session_id, status, payment_status, created_at, refund_bank_name, refund_completed_at"),
    supabase.from("admin_attendee_view").select("application_id"),
    supabase
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .is("matched_application_id", null)
      .is("ignored_at", null),
  ]);

  if (sessionsRes.error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-5xl">
          <AdminNav current="/" />
          <div className="text-red-400">세션 목록을 불러올 수 없습니다: {sessionsRes.error.message}</div>
        </div>
      </div>
    );
  }

  const sessions = (sessionsRes.data ?? []) as Session[];
  const apps = (appsRes.data ?? []) as {
    id: string;
    session_id: string;
    status: string;
    payment_status: string;
    created_at: string;
    refund_bank_name: string | null;
    refund_completed_at: string | null;
  }[];
  const attendees = (attendeesRes.data ?? []) as { application_id: string }[];

  const headcountOf = (appId: string) => attendees.filter((a) => a.application_id === appId).length;

  // ── 처리 대기 ─────────────────────────────────────────────
  const unpaidConfirmed = apps.filter((a) => a.status === "confirmed" && a.payment_status === "pending");
  const waiting = apps.filter((a) => a.status === "waiting");
  // ⚠️ 환불 대기는 "환불 계좌를 준 취소 건"만 센다.
  //    refund_completed_at is null 만으로 세면 입금 전 단순 취소까지 잡힌다(2026-09-10 확인).
  const refundPending = apps.filter(
    (a) => a.status === "cancelled" && a.refund_bank_name && !a.refund_completed_at
  );
  const unmatchedDeposits = unmatchedRes.count ?? 0;

  // ── 이번 주 ───────────────────────────────────────────────
  // ⚠️ 렌더 중 Date.now() 를 직접 부르면 react-hooks/purity 위반이다.
  //    이 페이지는 force-dynamic 이라 요청마다 새로 계산되며,
  //    기준 시각을 한 번만 구해 아래에서 재사용한다.
  const nowMs = getNowMs();
  const weekAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentApps = apps.filter((a) => a.created_at >= weekAgo);
  const recentPeople = recentApps.reduce((sum, a) => sum + headcountOf(a.id), 0);

  const upcoming = sessions
    .filter((s) => new Date(s.start_at).getTime() > nowMs && s.status !== "cancelled")
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const statsBySessionId = new Map<string, SessionStats>();
  await Promise.all(
    sessions.map(async (s) => {
      try {
        statsBySessionId.set(s.id, await getSessionStats(s.id));
      } catch (err) {
        console.error(`[admin] 세션 통계 조회 실패: ${s.id}`, err);
      }
    })
  );

  const unpaidBySession = countUnpaidConfirmed(apps, attendees);

  // 카드를 누르면 해당 조건이 걸린 신청 목록으로 바로 간다.
  const todo = [
    { label: "미매칭 입금", count: unmatchedDeposits, href: "/applications", tone: "red" as const },
    {
      label: "입금 확인 전",
      count: unpaidConfirmed.length,
      href: "/applications?status=confirmed&payment=pending",
      tone: "amber" as const,
    },
    { label: "환불 대기", count: refundPending.length, href: "/applications?status=cancelled", tone: "amber" as const },
    { label: "대기자", count: waiting.length, href: "/applications?status=waiting", tone: "blue" as const },
  ];

  const toneClass = {
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-sky-400",
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <AdminNav current="/" />

        <h1 className="mb-6 text-2xl font-bold">대시보드</h1>

        {/* ── 처리 대기 ── */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">처리 대기</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {todo.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/10"
              >
                <p className="text-xs text-muted">{t.label}</p>
                <p className={`mt-1 text-2xl font-bold ${t.count > 0 ? toneClass[t.tone] : "text-muted"}`}>
                  {t.count}
                  <span className="ml-1 text-sm font-normal text-muted">건</span>
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 이번 주 ── */}
        <section className="mb-8 rounded-lg border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold text-muted">최근 7일</h2>
          <p className="text-sm">
            신청 <strong>{recentApps.length}건</strong> · 참여 인원 <strong>{recentPeople}명</strong>
          </p>
          {upcoming.length > 0 ? (
            <p className="mt-2 text-sm text-muted">
              다가오는 회차: <strong className="text-foreground">{formatSessionDateTime(upcoming[0].start_at)}</strong>
              {upcoming.length > 1 && ` 외 ${upcoming.length - 1}건`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-400">
              예정된 회차가 없습니다. <Link href="/sessions" className="underline">회차 열기</Link>
            </p>
          )}
        </section>

        {/* ── 회차 목록 ── */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">회차 ({sessions.length})</h2>
            <Link href="/sessions" className="text-xs text-glow underline">
              회차 관리 →
            </Link>
          </div>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                등록된 회차가 없습니다. <Link href="/sessions" className="underline">회차 열기</Link>
              </p>
            ) : (
              sessions.map((session) => {
                const stats = statsBySessionId.get(session.id);
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">
                          {session.theme_name ?? session.theme_label}
                          {session.session_type && (
                            <span className="ml-2 rounded bg-muted/20 px-1.5 py-0.5 text-[11px] font-normal text-muted">
                              {session.session_type}
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-muted">{formatSessionDateTime(session.start_at)}</p>
                        <p className="mt-1 text-xs text-muted">{formatCapacityLine(session)}</p>
                        {stats && <p className="mt-1 text-xs text-muted">{formatHeadcountLine(stats)}</p>}
                        <p className="mt-1 text-xs text-muted">
                          입금 확인 전 인원: {unpaidBySession.get(session.id) ?? 0}명
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-sm font-medium">
                          <span className={session.status === "cancelled" ? "text-red-500" : "text-glow"}>
                            {session.status === "open" ? "모집중" : session.status === "cancelled" ? "비활성화" : "마감"}
                          </span>
                        </span>
                        <CopyUrlButton url={`${SITE_URL}/sessions/${session.slug}`} />
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted">
          매출·정산, 고객 관리, 공지·FAQ 편집은 준비 중입니다.
        </p>
      </div>
    </div>
  );
}
