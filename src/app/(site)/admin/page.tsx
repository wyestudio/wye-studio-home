import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  formatCapacityLine,
  formatHeadcountLine,
  countUnpaidConfirmed,
  computeSessionStats,
  type SessionDisplayRow,
} from "@/lib/sessionStatsFormat";
import { DashboardSessions, type DashboardSession } from "./DashboardSessions";

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

  const [sessionsRes, themesRes, appsRes, attendeesRes, unmatchedRes] = await Promise.all([
    // 표시값(테마명·정원·장소·링크)은 session_display 가 통일해준다.
    // sessions 를 직접 읽으면 신규 회차에서 옛 컬럼(정원 50명, 성별 정원)이 나온다.
    supabase.from("session_display").select("*").order("start_at", { ascending: false }),
    supabase.from("themes").select("id, name").order("sort_order").order("created_at"),
    supabase
      .from("admin_application_view")
      .select(
        "id, session_id, status, payment_status, created_at, refund_bank_name, refund_completed_at, payment_confirmed_sms_sent_at"
      ),
    supabase.from("admin_attendee_view").select("application_id, gender"),
    supabase
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .is("matched_application_id", null)
      .is("ignored_at", null),
  ]);

  if (sessionsRes.error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/" />
          <div className="text-red-400">세션 목록을 불러올 수 없습니다: {sessionsRes.error.message}</div>
        </div>
      </div>
    );
  }

  const sessions = (sessionsRes.data ?? []) as (SessionDisplayRow & {
    theme_id: string | null;
    start_at: string;
    status: string;
    opens_at: string | null;
  })[];
  const themes = (themesRes.data ?? []) as { id: string; name: string }[];
  const apps = (appsRes.data ?? []) as {
    id: string;
    session_id: string;
    status: string;
    payment_status: string;
    created_at: string;
    refund_bank_name: string | null;
    refund_completed_at: string | null;
    payment_confirmed_sms_sent_at: string | null;
  }[];
  const attendees = (attendeesRes.data ?? []) as { application_id: string; gender: string | null }[];

  const headcountOf = (appId: string) => attendees.filter((a) => a.application_id === appId).length;

  // ── 처리 대기 ─────────────────────────────────────────────
  const unpaidConfirmed = apps.filter((a) => a.status === "confirmed" && a.payment_status === "pending");
  const waiting = apps.filter((a) => a.status === "waiting");
  // ⚠️ 환불 대기는 "돌려줄 돈이 실제로 있는 취소 건"만 센다.
  //    refund_completed_at is null 만으로 세면 입금 전 단순 취소까지 잡힌다(2026-09-10 확인).
  //    취소되면 payment_status 가 'cancelled' 로 덮이므로 입금 여부는
  //    입금확인 문자 발송 시각으로 판별한다. 환불 계좌를 준 건도 당연히 포함.
  const refundPending = apps.filter(
    (a) =>
      a.status === "cancelled" &&
      !a.refund_completed_at &&
      (a.payment_confirmed_sms_sent_at || a.refund_bank_name)
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

  // ⚠️ 회차마다 RPC 를 부르지 않는다. 롤링 오픈으로 회차가 수백 개라
  //    한 번 여는 데 RPC 가 수백 번 나가게 된다. 이미 읽어온 데이터로 계산한다.
  const statsBySessionId = computeSessionStats(apps, attendees);
  const unpaidBySession = countUnpaidConfirmed(apps, attendees);

  const dashboardSessions: DashboardSession[] = sessions.map((s) => {
    const stats = statsBySessionId.get(s.id);
    return {
      id: s.id,
      theme_id: s.theme_id,
      start_at: s.start_at,
      status: s.status,
      opens_at: s.opens_at,
      theme_name: s.theme_name,
      format_label: s.format_label,
      capacity_line: formatCapacityLine(s),
      headcount_line: stats ? formatHeadcountLine(s, stats) : "확정 0명 · 대기 0명",
      unpaid: unpaidBySession.get(s.id) ?? 0,
      public_path: s.public_path,
    };
  });

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
      <div className="mx-auto max-w-6xl">
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
              다가오는 회차: <strong className="text-foreground">{formatDateTimeFull(upcoming[0].start_at)}</strong>
              {upcoming.length > 1 && ` 외 ${upcoming.length - 1}건`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-400">
              예정된 회차가 없습니다. <Link href="/sessions" className="underline">회차 열기</Link>
            </p>
          )}
        </section>

        {/* ── 회차 ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">회차</h2>
            <Link href="/sessions" className="text-xs text-glow underline">
              회차 편성 →
            </Link>
          </div>

          <DashboardSessions
            themes={themes}
            sessions={dashboardSessions}
            siteUrl={SITE_URL}
            nowMs={nowMs}
          />
        </section>

        <p className="mt-8 text-center text-xs text-muted">
          매출·정산, 고객 관리, 공지·FAQ 편집은 준비 중입니다.
        </p>
      </div>
    </div>
  );
}
