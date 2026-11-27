import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
import {
  formatHeadcountLine,
  countUnpaidConfirmed,
  computeSessionStats,
  type SessionDisplayRow,
} from "@/lib/sessionStatsFormat";
import {
  DashboardSessions,
  type DashboardClosure,
  type DashboardGroup,
  type DashboardSession,
} from "./DashboardSessions";
import { BASE_MINUTES, OPTION, addDays, kstToday } from "@/lib/groupPricing";
import { GROUP_BOOKING_THEME_SLUGS } from "@/lib/groupBooking";
import { withBack } from "@/lib/adminBack";
import { formatDateFull } from "@/lib/format";
import { sessionPrepKey, type HomeTodo } from "@/lib/adminTodos";
import { daysBetween } from "@/lib/groupSettlement";
import { maskName } from "@/lib/groupStage";
import { HomeTodos } from "./HomeTodos";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다. */
function getNowMs(): number {
  return Date.now();
}

// 회차 시각(KST 'HH:MM'). 회차마다 새로 만들지 않게 모듈에 하나만 둔다(wye-server-cost).
const KST_HM = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
const KST_YMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

/**
 * 어드민 홈 — 오늘 할 일 + 월 달력(2026-11-27 관리자 개편 2단계. 예전 이름은 대시보드).
 *
 * 지표보다 "지금 내가 뭘 해야 하나" 를 위에 둔다. 매주 운영에서 실제로 필요한 건 그것이기 때문이다.
 * 지표는 홈에 두지 않는다(분석 메뉴). 설계 근거: docs/08-architecture-screens-and-admin.md §3-3
 *
 * 예전의 「처리 대기」 카드 네 장(미매칭 입금 · 입금 확인 전 · 기한 넘김 · 환불 대기)은 오늘 할 일의 줄이 됐다.
 * ⚠️ **무엇을 세는지는 그대로다.** 아래 계산(지난 회차 제외, 환불 대기만 예외)을 바꾸지 않고 모양만 옮겼다.
 */
export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  // 달력에서 보던 날짜(?date=) — 상세에 갔다 돌아오면 그 날짜를 다시 연다.
  const rawDate = (await searchParams).date;
  const initialDate = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
  const supabase = createAdminClient();

  const [sessionsRes, themesRes, appsRes, attendeesRes, unmatchedRes] = await Promise.all([
    // 표시값(테마명·정원·장소·링크)은 session_display 가 통일해준다.
    // sessions 를 직접 읽으면 신규 회차에서 옛 컬럼(정원 50명, 성별 정원)이 나온다.
    supabase.from("session_display").select("*").order("start_at", { ascending: false }),
    supabase.from("themes").select("id, name, slug, max_teams_per_session").order("sort_order").order("created_at"),
    supabase
      .from("admin_application_view")
      .select(
        "id, session_id, status, payment_status, created_at, refund_bank_name, refund_completed_at, paid_at"
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
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-danger">세션 목록을 불러올 수 없습니다: {sessionsRes.error.message}</div>
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
  const themes = (themesRes.data ?? []) as { id: string; name: string; slug: string; max_teams_per_session: number | null }[];
  // 「단체 막기」 를 띄울 회차 — 단체 예약을 받는 테마(파티모드)의 것만. 이미 막아 둔 회차는 켜진 상태로.
  const groupThemeIds = new Set(themes.filter((t) => GROUP_BOOKING_THEME_SLUGS.includes(t.slug)).map((t) => t.id));
  // 단체 일정 — 달력에 회차와 같이 놓는다. 막은 일정 표 하나에 세 갈래(직접 · 예약 확정 · 파티 회차)가 모인다.
  const [{ data: closureRows }, { data: groupRows }, manualTodosRes, dismissalsRes, checklistRes, leaderRes] = await Promise.all([
    supabase.from("group_booking_closures").select("id, date, start_time, minutes, note, inquiry_id, session_id"),
    supabase
      .from("admin_group_booking_inquiries_view")
      .select(
        "id, organizer_name, group_name, headcount, status, preferred_date, preferred_time, options, stage, event_date, deposit_paid_at, cancelled_at"
      ),
    // 직접 적은 할 일 — 남은 일 전부와, 끝낸 지 하루가 안 된 일(아래에 흐리게 남긴다).
    supabase
      .from("admin_todos")
      .select("id, text, done_at, created_at")
      .or(`done_at.is.null,done_at.gte.${new Date(getNowMs() - 86_400_000).toISOString()}`)
      .order("created_at", { ascending: true }),
    // 자동 할 일을 끝냄으로 체크한 기록 — 키에 날짜가 들어 있어 최근 것만 읽으면 된다.
    supabase
      .from("admin_todo_dismissals")
      .select("todo_key")
      .gte("done_at", new Date(getNowMs() - 3 * 86_400_000).toISOString()),
    // 단체 준비 체크리스트 중 아직 안 끝난 줄 — 행사 3일 전부터 할 일에 올린다.
    supabase.from("group_checklist_items").select("inquiry_id").is("done_at", null),
    // 모임장 신청서 — 수정 요청과 「신청서와 다른 내용」 이 남은 단체(답 · 연락처는 읽지 않는다).
    supabase.from("group_leader_responses").select("inquiry_id, edit_request, pending"),
  ]);
  type ClosureRow = DashboardClosure & { inquiry_id: string | null; session_id: string | null };
  const closureList = (closureRows ?? []) as ClosureRow[];
  const blockedSessions = new Set(closureList.filter((c) => c.session_id).map((c) => c.session_id!));
  const bookingByInquiry = new Map(
    closureList
      .filter((c) => c.inquiry_id && c.start_time)
      .map((c) => [c.inquiry_id!, { date: c.date, time: c.start_time!, minutes: c.minutes ?? BASE_MINUTES }])
  );
  const groupList = (
    (groupRows ?? []) as {
      id: string;
      organizer_name: string | null;
      group_name: string | null;
      headcount: number;
      status: string;
      preferred_date: string | null;
      preferred_time: string;
      options: { icebreaking?: boolean; after_party_hours?: number } | null;
      stage: string;
      event_date: string | null;
      deposit_paid_at: string | null;
      cancelled_at: string | null;
    }[]
  );
  const dashboardGroups: DashboardGroup[] = groupList.map((g) => ({
    id: g.id,
    name: g.group_name ?? g.organizer_name ?? "이름 없음",
    headcount: g.headcount,
    status: g.status,
    preferred_date: g.preferred_date,
    preferred_time: g.preferred_time,
    // 희망 구간의 길이 — 견적 시간(프로그램 + 애프터파티). 레크리에이션을 뺐으면 30분 짧다.
    minutes:
      BASE_MINUTES -
      (g.options?.icebreaking === false ? OPTION.icebreaking.minutes : 0) +
      (g.options?.after_party_hours ?? 0) * 60,
    booking: g.status === "booked" ? (bookingByInquiry.get(g.id) ?? null) : null,
  }));
  const manualClosures: DashboardClosure[] = closureList
    .filter((c) => !c.inquiry_id && !c.session_id)
    .map(({ id, date, start_time, minutes, note }) => ({ id, date, start_time, minutes, note }));
  const apps = (appsRes.data ?? []) as {
    id: string;
    session_id: string;
    status: string;
    payment_status: string;
    created_at: string;
    refund_bank_name: string | null;
    refund_completed_at: string | null;
    paid_at: string | null;
  }[];
  const attendees = (attendeesRes.data ?? []) as { application_id: string; gender: string | null }[];


  // ⚠️ 렌더 중 Date.now() 를 직접 부르면 react-hooks/purity 위반이다.
  //    이 페이지는 force-dynamic 이라 요청마다 새로 계산되며,
  //    기준 시각을 한 번만 구해 아래에서 재사용한다.
  const nowMs = getNowMs();

  // ── 처리 대기 ─────────────────────────────────────────────
  //
  // ⚠️ 이 카드들은 "지금 내가 처리할 것"만 센다. 이미 끝난 회차는 세지 않는다.
  //    롤링 오픈으로 지난 회차가 계속 쌓이는데, 그 회차의 미입금·대기자까지
  //    합치면 숫자가 줄지 않아 카드가 의미를 잃는다(지난 회차는 이제 와서
  //    입금을 받을 일도, 대기자를 승격시킬 일도 없다).
  //    지난 회차의 개별 건은 회차별 목록에서 그대로 볼 수 있다.
  const activeSessionIds = new Set(
    sessions
      .filter((s) => new Date(s.start_at).getTime() > nowMs && s.status !== "cancelled")
      .map((s) => s.id)
  );
  const isActive = (a: { session_id: string }) => activeSessionIds.has(a.session_id);

  const unpaidConfirmed = apps.filter(
    (a) => a.status === "confirmed" && a.payment_status === "pending" && isActive(a)
  );
  // 입금기한(30분)을 넘긴 건은 따로 센다. 신청 직후 몇 분 지난 건과
  // 한참 전에 신청해놓고 입금이 없는 건은 운영자가 할 일이 다르다.
  // ⚠️ 자동 취소하지 않는다 — 지금 payment_status 를 바꾸는 건 사람이라
  //    타이머가 재는 것은 고객의 입금 시간이 아니라 운영자의 확인 시간이다.
  //    (/api/cron/unpaid-alert 주석 참고)
  const UNPAID_DEADLINE_MS = 30 * 60 * 1000;
  const unpaidOverdue = unpaidConfirmed.filter(
    (a) => nowMs - new Date(a.created_at).getTime() > UNPAID_DEADLINE_MS
  );

  // ⚠️ 환불 대기만 규칙이 다르다 — 환불 의무는 회차가 끝나도 사라지지 않는다.
  //    그래서 "고객이 환불 계좌를 준 건"(refund_bank_name)은 지난 회차라도 계속 센다.
  //    반대로 계좌가 없는 건은 진행 예정 회차만 센다.
  //
  //    왜 이렇게 갈랐나 (2026-09-12 확인):
  //    취소되면 payment_status 가 'cancelled' 로 덮여서 "입금했었는지"를 DB 가
  //    알 수 없다. 그래서 입금확인 표시(payment_confirmed_sms_sent_at)를 대신
  //    썼는데, 그 값은 어드민 수동 등록에서도 문자 없이 찍혀 오탐이 났다.
  //    그 결과 8/29 팀 내부 테스트 신청 5건(입금자명 '테스트'·'김종진'·'이은지',
  //    문자1 미발송)이 영원히 '환불 대기'로 남아 있었다.
  //    지금은 의미가 분명한 paid_at 을 쓴다(마이그레이션 p20).
  //    환불 계좌를 준 것은 고객이 직접 "돌려달라"고 한 것이라 오탐이 없다.
  const refundPending = apps.filter(
    (a) =>
      a.status === "cancelled" &&
      !a.refund_completed_at &&
      (a.refund_bank_name || (a.paid_at && isActive(a)))
  );
  const unmatchedDeposits = unmatchedRes.count ?? 0;

  // ⚠️ 회차마다 RPC 를 부르지 않는다. 롤링 오픈으로 회차가 수백 개라
  //    한 번 여는 데 RPC 가 수백 번 나가게 된다. 이미 읽어온 데이터로 계산한다.
  const statsBySessionId = computeSessionStats(apps, attendees);
  const unpaidBySession = countUnpaidConfirmed(apps, attendees);

  // 노말모드 회차 카드용 — 예약 인원과 입금 상태. 노말은 한 팀만 받으니 '확정 · 대기' 대신 이게 맞다.
  const bookedBySession = new Map<string, { people: number; unpaid: boolean; paid: boolean }>();
  const peopleByApp = new Map<string, number>();
  for (const a of attendees) peopleByApp.set(a.application_id, (peopleByApp.get(a.application_id) ?? 0) + 1);
  for (const a of apps) {
    if (a.status === "cancelled") continue;
    const cur = bookedBySession.get(a.session_id) ?? { people: 0, unpaid: false, paid: false };
    cur.people += peopleByApp.get(a.id) ?? 0;
    if (a.payment_status === "confirmed") cur.paid = true;
    else cur.unpaid = true;
    bookedBySession.set(a.session_id, cur);
  }

  const dashboardSessions: DashboardSession[] = sessions.map((s) => {
    const booked = bookedBySession.get(s.id);
    const stats = statsBySessionId.get(s.id);
    return {
      id: s.id,
      theme_id: s.theme_id,
      start_at: s.start_at,
      status: s.status,
      opens_at: s.opens_at,
      theme_name: s.theme_name,
      // 모드가 있으면 배지로 보여준다(파티모드/노말모드). 옛 회차는 null 이라
      // format_label(소개팅/그룹)이 그대로 쓰인다 — 배지 자리를 새로 만들지 않는다.
      theme_mode: s.theme_mode ?? null,
      format_label: s.format_label,
      headcount_line: stats ? formatHeadcountLine(s, stats) : "확정 0명 · 대기 0명",
      confirmed: stats?.confirmed_count ?? 0,
      paid_confirmed: stats?.paid_confirmed_count ?? 0,
      capacity_max: s.capacity_max ?? null,
      booked_people: booked?.people ?? 0,
      payment_label: !booked ? null : booked.unpaid ? "입금 확인 전" : "입금 확인",
      unpaid: unpaidBySession.get(s.id) ?? 0,
      public_path: s.public_path,
      // 칸(p42·p43)이 아직 없는 DB 에서 읽어도 깨지지 않게.
      badge: (s as { badge?: string | null }).badge ?? null,
      group_block: s.theme_id && groupThemeIds.has(s.theme_id) ? blockedSessions.has(s.id) : null,
    };
  });

  // ── 오늘 할 일 ───────────────────────────────────────────
  // 회차가 어느 모드인가 — 건수 줄 아래에 '파티 2 · 노말 1' 로 나눠 적는다(세는 대상은 위 계산 그대로).
  const modeOf = new Map(
    sessions.map((s) => [s.id, s.theme_mode?.includes("노말") ? "노말" : s.theme_mode?.includes("파티") ? "파티" : "기타"])
  );
  const byMode = (list: { session_id: string }[]) => {
    const n = new Map<string, number>();
    for (const a of list) n.set(modeOf.get(a.session_id) ?? "기타", (n.get(modeOf.get(a.session_id) ?? "기타") ?? 0) + 1);
    return ["파티", "노말", "기타"]
      .filter((m) => n.has(m))
      .map((m) => `${m} ${n.get(m)}`)
      .join(" · ");
  };

  const todos: HomeTodo[] = [];
  // 건수 줄 — 0건이면 올리지 않는다. 체크할 수 없고, 처리하면 저절로 사라진다. 누르면 예전 카드와 같은 목록으로 간다.
  const countLine = (key: string, urgency: number, scope: string | null, title: string, sub: string, href: string) =>
    todos.push({ key, tab: "check", scope, title, sub, href, urgency, checkable: false, done: false, manualId: null });
  if (unmatchedDeposits > 0)
    countLine("count:unmatched", 0, null, `미매칭 입금 ${unmatchedDeposits}건`, "들어온 입금을 신청과 맞춰 주세요", "/applications");
  if (unpaidOverdue.length > 0)
    countLine(
      "count:overdue",
      1,
      null,
      `입금 기한 넘김 ${unpaidOverdue.length}건`,
      `신청 후 30분이 지났는데 입금 확인 전 · ${byMode(unpaidOverdue)}`,
      "/applications?status=confirmed&payment=pending"
    );
  if (refundPending.length > 0)
    countLine(
      "count:refund",
      2,
      null,
      `환불 대기 ${refundPending.length}건`,
      `취소됐고 환불이 아직 안 끝남 · ${byMode(refundPending)}`,
      "/applications?status=cancelled"
    );
  if (unpaidConfirmed.length > 0)
    countLine(
      "count:unpaid",
      3,
      null,
      `입금 확인 전 ${unpaidConfirmed.length}건`,
      `다가오는 회차의 확정 신청 · ${byMode(unpaidConfirmed)}`,
      "/applications?status=confirmed&payment=pending"
    );
  // 새 단체 견적(아직 연락 전). 단체의 나머지 할 일(문자 · 신청서 · 준비)은 단체 예약 화면을 만드는 단계에 채운다.
  const newInquiries = dashboardGroups.filter((g) => g.status === "new").length;
  if (newInquiries > 0)
    countLine("count:group-new", 4, "단체", `새 견적 ${newInquiries}건`, "아직 연락 전인 단체 견적", "/group-bookings?tab=new");

  // 단체 — 지금 데이터로 알 수 있는 일을 건별로 올린다. 처리하면(입금 확인 · 문자 복사 · 체크) 저절로 사라진다.
  const leaderByGroup = new Map(
    ((leaderRes.data ?? []) as { inquiry_id: string; edit_request: string | null; pending: unknown }[]).map((r) => [
      r.inquiry_id,
      { editRequest: !!r.edit_request, pending: Array.isArray(r.pending) ? r.pending.length : 0 },
    ])
  );
  const undoneByGroup = new Map<string, number>();
  for (const c of (checklistRes.data ?? []) as { inquiry_id: string }[]) {
    undoneByGroup.set(c.inquiry_id, (undoneByGroup.get(c.inquiry_id) ?? 0) + 1);
  }
  const todayYmd = kstToday(new Date(nowMs));
  for (const g of groupList) {
    if (g.cancelled_at) continue;
    // 모임 이름이 없으면 담당자 이름을 가려서 쓴다(홈에는 이름 전체를 싣지 않는다).
    const name = g.group_name ?? `${maskName(g.organizer_name)} 님`;
    const base = `/group-bookings/${g.id}`;
    const left = g.event_date ? daysBetween(todayYmd, g.event_date) : null;
    const when = left == null ? "" : left === 0 ? "오늘 행사" : left > 0 ? `행사 ${left}일 전` : `행사 ${-left}일 지남`;
    const line = (key: string, tab: HomeTodo["tab"], urgency: number, title: string, sub: string, href: string) =>
      todos.push({ key: `group:${g.id}:${key}`, tab, scope: "단체", title, sub, href, urgency, checkable: false, done: false, manualId: null });

    // 모임장 신청서 — 수정 요청과 견적과 다른 내용. 처리하면(열어주기 · 처리 완료 · 반영 · 넘기기) 사라진다.
    const leader = leaderByGroup.get(g.id);
    if (leader?.editRequest) line("leader-edit", "check", 2, `모임장 수정 요청 · ${name}`, "신청서를 고쳐 달라는 요청이 왔어요", base);
    if (leader && leader.pending > 0) {
      line("leader-pending", "check", 3, `신청서와 다른 내용 ${leader.pending}건 · ${name}`, "반영하면 금액을 다시 계산해요", base);
    }

    if (g.stage === "contacted" && !g.deposit_paid_at) {
      line("deposit", "check", 4, `예약금 입금 확인 · ${name}`, "견적 안내를 보냈고 입금을 기다리는 중", `${base}?tab=money`);
    }
    if (!g.deposit_paid_at || left == null) continue;
    if (left >= 0 && left <= 1 && (g.stage === "confirmed" || g.stage === "d7")) {
      line("d1", "sms", 0, `하루 전 안내 보내기 · ${name}`, when, `${base}?tab=forms`);
    } else if (left >= 0 && left <= 7 && g.stage === "confirmed") {
      line("d7", "sms", left <= 3 ? 1 : 3, `7일 전 안내 보내기 · ${name}`, when, `${base}?tab=forms`);
    }
    const undone = undoneByGroup.get(g.id) ?? 0;
    if (left >= 0 && left <= 3 && undone > 0) {
      line("prep", "prep", left, `준비 ${undone}개 남음 · ${name}`, when, base);
    }
    if (left < 0 && (g.stage === "confirmed" || g.stage === "d7" || g.stage === "d1")) {
      line("report", "prep", 6, `리포트 전달 · ${name}`, when, `${base}?tab=forms`);
    }
  }

  // 전날 · 당일 회차 — 신청자가 있는 파티모드, 예약이 들어온 노말모드만(2026-11-27 대표님). 체크할 수 있다.
  const today = kstToday(new Date(nowMs));
  const tomorrow = addDays(today, 1);
  const dismissed = new Set(((dismissalsRes.data ?? []) as { todo_key: string }[]).map((d) => d.todo_key));
  for (const s of dashboardSessions) {
    if (s.status === "cancelled" || s.booked_people <= 0) continue;
    if (new Date(s.start_at).getTime() <= nowMs) continue;
    const day = KST_YMD.format(new Date(s.start_at));
    if (day !== today && day !== tomorrow) continue;
    const normal = !!s.theme_mode?.includes("노말");
    const key = sessionPrepKey(s.id, today);
    todos.push({
      key,
      tab: "prep",
      scope: normal ? "노말" : s.theme_mode?.includes("파티") ? "파티" : (s.theme_name ?? "회차"),
      title: `${day === today ? "오늘" : "내일"} ${KST_HM.format(new Date(s.start_at))} · ${
        normal ? `예약 ${s.booked_people}명` : `확정 ${s.confirmed}명`
      }`,
      sub: normal ? (s.payment_label ?? "") : s.unpaid > 0 ? `입금 확인 전 ${s.unpaid}명` : "입금 확인 전 인원 없음",
      href: withBack(`/sessions/${s.id}`, `/?date=${day}`),
      urgency: day === today ? 5 : 6,
      checkable: true,
      done: dismissed.has(key),
      manualId: null,
    });
  }

  // 직접 적은 일
  const manualTodos = (manualTodosRes.data ?? []) as { id: string; text: string; done_at: string | null }[];
  for (const m of manualTodos) {
    todos.push({
      key: `manual:${m.id}`,
      tab: "prep",
      scope: null,
      title: m.text,
      sub: "직접 등록",
      href: null,
      urgency: 7,
      checkable: true,
      done: m.done_at != null,
      manualId: m.id,
    });
  }
  // 할 일 표를 못 읽어도 홈은 떠야 한다 — 건수 줄 · 달력은 그대로 보이고, 못 읽었다는 것만 알린다.
  const todoStoreError = manualTodosRes.error?.message ?? dismissalsRes.error?.message ?? null;

  return (
    <AdminPage title="홈" description={formatDateFull(`${today}T12:00:00+09:00`)}>
      {todoStoreError && (
        <p role="alert" className="mb-3 text-body-sm text-danger">
          직접 적은 할 일과 체크 기록을 불러오지 못했습니다: {todoStoreError}
        </p>
      )}
      <HomeTodos todos={todos} />

      {/* ── 일정 ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-foreground">일정</h2>
          <Link href="/sessions?tab=schedule" className="flex min-h-11 items-center text-body-sm text-glow underline">
            회차 편성
          </Link>
        </div>

        <DashboardSessions
          sessions={dashboardSessions}
          groups={dashboardGroups}
          closures={manualClosures}
          siteUrl={SITE_URL}
          nowMs={nowMs}
          initialDate={initialDate}
        />
      </section>
    </AdminPage>
  );
}
