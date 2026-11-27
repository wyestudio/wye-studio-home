import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminBadge, AdminEmpty, AdminPage, AdminTabs, adminButtonClass, type AdminTone } from "@/components/admin/ui";
import { Chevron } from "@/components/ui/Chevron";
import { formatDateTimeFull } from "@/lib/format";
import { withBack } from "@/lib/adminBack";
import type { Theme } from "@/types/catalog";
import { SessionManager, type ThemeSchedule } from "./SessionManager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const TABS = [
  { key: "upcoming", label: "다가오는 회차" },
  { key: "past", label: "지난 회차" },
  { key: "schedule", label: "편성" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** 현재 시각. 렌더 함수 밖으로 빼 purity 규칙을 지킨다(홈 · 회차 상세와 같다). */
function getNowIso(): string {
  return new Date().toISOString();
}

type SessionRow = {
  id: string;
  start_at: string;
  status: string;
  opens_at: string | null;
  theme_name: string | null;
  theme_mode: string | null;
  format_label: string | null;
  capacity_max: number | null;
};

/**
 * 회차 — 다가오는 회차 / 지난 회차 / 편성(관리자 개편 docs/01 5장, 2026-11-27 대표님).
 *
 * 예전에는 편성 규칙만 있고 회차 목록은 홈 달력에서만 봤다. 지난 회차를 찾기 어려워 목록 탭 둘을 더했다.
 * 목록은 읽기만 한다 — 고르면 회차 상세(/sessions/[id])로 가고, 처리는 거기서 한다.
 * 편성 탭은 예전 화면 그대로다(SessionManager · saveSchedule).
 */
export default async function AdminSessionsPage({ searchParams }: PageProps<"/admin/sessions">) {
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "upcoming";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const supabase = createAdminClient();
  const nowIso = getNowIso();
  const nowMs = Date.parse(nowIso);
  const tabHref = (key: TabKey, n = 1) => `/sessions?tab=${key}${n > 1 ? `&page=${n}` : ""}`;

  // 탭 건수 — 줄은 받지 않고 개수만 센다.
  const [upcomingCount, pastCount] = await Promise.all([
    supabase.from("session_display").select("id", { count: "exact", head: true }).gte("start_at", nowIso),
    supabase.from("session_display").select("id", { count: "exact", head: true }).lt("start_at", nowIso),
  ]);
  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: tabHref(t.key),
    count: t.key === "upcoming" ? (upcomingCount.count ?? undefined) : t.key === "past" ? (pastCount.count ?? undefined) : undefined,
  }));

  if (tab === "schedule") {
    const [themesRes, schedulesRes] = await Promise.all([
      supabase.from("themes").select("*").order("sort_order").order("created_at"),
      supabase.from("theme_schedules").select("*"),
    ]);
    const error = themesRes.error ?? schedulesRes.error;
    return (
      <AdminPage
        title="회차"
        description={
          <>
            테마마다 <strong>언제 진행하고 언제 신청을 여는지</strong>를 정합니다. 회차는 이 규칙대로 자동으로 만들어지고, 정해진 시점이 되면 저절로
            신청 가능해집니다.
          </>
        }
      >
        <AdminTabs tabs={tabs} current={tab} />
        {error ? (
          <p role="alert" className="text-body-sm text-danger">
            편성을 불러올 수 없습니다: {error.message}
          </p>
        ) : (
          <SessionManager themes={(themesRes.data ?? []) as Theme[]} schedules={(schedulesRes.data ?? []) as ThemeSchedule[]} />
        )}
      </AdminPage>
    );
  }

  // ── 목록 ── 다가오는 회차는 가까운 것부터, 지난 회차는 최근 것부터.
  const base = supabase
    .from("session_display")
    .select("id, start_at, status, opens_at, theme_name, theme_mode, format_label, capacity_max");
  const sessionsRes = await (tab === "upcoming"
    ? base.gte("start_at", nowIso).order("start_at", { ascending: true })
    : base.lt("start_at", nowIso).order("start_at", { ascending: false })
  ).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const sessions = (sessionsRes.data ?? []) as SessionRow[];
  // 이 쪽에 보이는 회차의 신청만 읽는다. 이름 · 연락처는 읽지 않는다(인원과 상태만).
  const appsRes =
    sessions.length > 0
      ? await supabase
          .from("applications")
          .select("session_id, status, payment_status, headcount")
          .in("session_id", sessions.map((s) => s.id))
          .neq("status", "cancelled")
      : { data: [], error: null };
  const error = sessionsRes.error ?? appsRes.error;

  const sum = new Map<string, { confirmed: number; waiting: number; unpaid: number }>();
  for (const a of (appsRes.data ?? []) as { session_id: string; status: string; payment_status: string; headcount: number | null }[]) {
    const cur = sum.get(a.session_id) ?? { confirmed: 0, waiting: 0, unpaid: 0 };
    const n = a.headcount ?? 0;
    if (a.status === "confirmed") {
      cur.confirmed += n;
      if (a.payment_status !== "confirmed") cur.unpaid += n;
    } else if (a.status === "waiting") cur.waiting += n;
    sum.set(a.session_id, cur);
  }

  const total = (tab === "upcoming" ? upcomingCount.count : pastCount.count) ?? sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const here = tabHref(tab, page);
  const stateOf = (s: SessionRow): { label: string; tone: AdminTone } =>
    s.status === "cancelled"
      ? { label: "비활성화", tone: "danger" }
      : tab === "past"
        ? // 지난 회차는 모집 상태가 의미 없다 — 열려 있던 회차가 「모집중」 으로 보이면 헷갈린다.
          { label: "종료", tone: "idle" }
        : s.opens_at && Date.parse(s.opens_at) > nowMs
        ? { label: "공개 전", tone: "warn" }
        : s.status === "open"
          ? { label: "모집중", tone: "progress" }
          : { label: "마감", tone: "idle" };
  const peopleLine = (s: SessionRow) => {
    const c = sum.get(s.id);
    const confirmed = c?.confirmed ?? 0;
    // 노말모드는 한 팀만 받는다 — 정원 대신 예약 인원으로 적는다(회차 상세와 같다).
    if (s.theme_mode?.includes("노말")) return confirmed > 0 ? `예약 ${confirmed}명` : "예약 없음";
    return `확정 ${confirmed}명${s.capacity_max ? ` / ${s.capacity_max}명` : ""}${c?.waiting ? ` · 대기 ${c.waiting}명` : ""}`;
  };

  return (
    <AdminPage
      title="회차"
      description="회차를 고르면 그 회차의 신청자 · 문자 · 설정으로 갑니다. 날짜별로 보려면 홈 달력을, 반복 규칙은 「편성」 탭을 쓰세요."
    >
      <AdminTabs tabs={tabs} current={tab} />

      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          회차를 불러올 수 없습니다: {error.message}
        </p>
      ) : sessions.length === 0 ? (
        <AdminEmpty
          title={tab === "upcoming" ? "다가오는 회차가 없어요" : "지난 회차가 없어요"}
          hint={tab === "upcoming" ? "「편성」 탭에서 테마의 반복 규칙을 저장하면 회차가 만들어집니다." : undefined}
          action={
            tab === "upcoming" ? (
              <Link href={tabHref("schedule")} className={adminButtonClass("secondary")}>
                편성으로 가기
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-body-sm text-muted">
            총 <strong className="text-foreground">{total}</strong>건{totalPages > 1 && ` · ${page} / ${totalPages} 쪽`}
          </p>

          {/* 휴대폰: 카드 */}
          <ul className="flex flex-col gap-2 md:hidden">
            {sessions.map((s) => {
              const st = stateOf(s);
              const unpaid = sum.get(s.id)?.unpaid ?? 0;
              return (
                <li key={s.id}>
                  <Link
                    href={withBack(`/sessions/${s.id}`, here)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-fill-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-body font-semibold tabular-nums text-foreground">{formatDateTimeFull(s.start_at)}</span>
                        <AdminBadge tone={st.tone}>{st.label}</AdminBadge>
                      </div>
                      <div className="mt-1 text-body-sm text-muted">
                        {s.theme_name ?? "-"} {s.theme_mode ?? s.format_label ?? ""}
                      </div>
                      <div className="mt-0.5 text-body-sm tabular-nums text-muted">
                        {peopleLine(s)}
                        {unpaid > 0 && <span className="text-wait"> · 입금 전 {unpaid}명</span>}
                      </div>
                    </div>
                    <Chevron className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* 컴퓨터: 표 — 열 5개 */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-body-sm">
              <thead className="border-b border-border text-left text-label text-muted">
                <tr>
                  <th className="px-3 py-2.5">일시</th>
                  <th className="px-3 py-2.5">테마</th>
                  <th className="px-3 py-2.5">신청</th>
                  <th className="px-3 py-2.5">입금 전</th>
                  <th className="px-3 py-2.5">상태</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const st = stateOf(s);
                  const unpaid = sum.get(s.id)?.unpaid ?? 0;
                  return (
                    <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-fill-subtle">
                      <td className="px-3 py-3">
                        <Link href={withBack(`/sessions/${s.id}`, here)} className="font-semibold tabular-nums text-glow hover:underline">
                          {formatDateTimeFull(s.start_at)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {s.theme_name ?? "-"}
                        {(s.theme_mode ?? s.format_label) && <span className="ml-1.5 text-muted">{s.theme_mode ?? s.format_label}</span>}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{peopleLine(s)}</td>
                      <td className="px-3 py-3 tabular-nums">{unpaid > 0 ? <span className="text-wait">{unpaid}명</span> : <span className="text-muted">-</span>}</td>
                      <td className="px-3 py-3">
                        <AdminBadge tone={st.tone}>{st.label}</AdminBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {page > 1 && (
                <Link href={tabHref(tab, page - 1)} className={adminButtonClass("secondary")}>
                  이전
                </Link>
              )}
              {page < totalPages && (
                <Link href={tabHref(tab, page + 1)} className={adminButtonClass("secondary")}>
                  다음
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}
