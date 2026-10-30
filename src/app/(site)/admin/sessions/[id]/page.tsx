import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull, formatKrw } from "@/lib/format";
import { DeactivateSessionButton } from "./DeactivateSessionButton";
import { SessionStatusToggle } from "@/components/admin/SessionStatusToggle";
import { SendReminderButton } from "./SendReminderButton";
import { ManualApplyButton } from "./ManualApplyButton";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";
import { ApplicationActionMenu } from "./ApplicationActionMenu";
import { RefundCompleteButton } from "./RefundCompleteButton";
import { getInternalApplicationIds } from "@/lib/internalTraffic";
import { getSessionStats } from "@/lib/sessions";
import { formatHeadcountLine, countUnpaidConfirmed, type SessionDisplayRow } from "@/lib/sessionStatsFormat";
import { Chevron } from "@/components/ui/Chevron";
import type { ExperienceRange } from "@/lib/validation";
import { isDatingTheme } from "@/lib/theme";
import { getParticipationHistory, revisitLabel } from "@/lib/participationHistory";

export const dynamic = "force-dynamic";

type PageProps = Promise<{ id: string }>;

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다(대시보드와 같다). */
function getNowMs(): number {
  return Date.now();
}

/** admin_application_view 한 줄 — 이 화면이 읽는 칸만. */
type App = {
  id: string;
  session_id: string;
  status: string;
  payment_status: string;
  confirmation_code: string;
  depositor_name: string;
  consent_required: boolean;
  consent_optional: boolean;
  consent_photo: boolean;
  consent_marketing: boolean;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  promoted_from_waiting_at: string | null;
  refund_bank_name: string | null;
  refund_account_number: string | null;
  refund_account_holder: string | null;
  refund_completed_at: string | null;
  amount_krw: number | null;
  is_internal: boolean;
};

/** admin_attendee_view 한 줄 + 몇 번째 참여인지. */
type Att = {
  id: string;
  application_id: string;
  is_representative: boolean;
  name: string;
  phone: string;
  birth_year: number | null;
  nickname: string | null;
  gender: "M" | "F" | null;
  experience_range: ExperienceRange | null;
  revisit: string | null;
};

/**
 * 이 취소 건에 돌려줄 돈이 있는가.
 *
 * 취소되면 payment_status 가 'cancelled' 로 덮여 입금 여부를 잃는다.
 * 그래서 취소돼도 남는 paid_at 으로 "입금까지 갔던 건" 인지 판별한다.
 *
 * ⚠️ 예전에는 payment_confirmed_sms_sent_at 을 썼는데, 그 값은 어드민 수동
 *    등록에서도 문자 없이 찍혀 오탐이 났다(2026-09-12). paid_at 으로 옮겼다.
 *    옛 데이터는 마이그레이션 p20 에서 paid_at 으로 백필했다.
 *
 * 이걸 구분하지 않으면 입금 전 단순 취소까지 전부 "환불 미완료" 로 보여
 * 처리할 게 없는데도 처리 대기처럼 쌓인다.
 */
function needsRefund(app: App): boolean {
  return Boolean(app.paid_at) || Boolean(app.refund_bank_name);
}

const tag = "rounded-md px-2 py-0.5 text-micro font-semibold";

/**
 * 신청 한 건 — 카드 하나.
 *
 * 예전엔 표였는데 휴대폰에서 입금 상태 · 액션 칸이 화면 밖으로 밀렸다(2026-10-30 대표님).
 * 카드 윗줄에 접수번호 · 상태 · 액션을 모으고, 참여자는 한 줄씩 적는다.
 */
function AppCard({
  app,
  atts,
  session,
  showPromoted,
}: {
  app: App;
  atts: Att[];
  session: { id: string; min_age: number | null };
  /** 파티모드 확정 건 — 대기에서 올라온 건인지 보여 준다. */
  showPromoted: boolean;
}) {
  const cancelled = app.status === "cancelled";
  const people = atts.length;
  // 신청 건에 대한 것(인원 · 금액 · 입금자 …)과 사람에 대한 것(이름 · 성별 · 출생 · 전화)을
  // 칸을 나눠 적는다 — 가운데점으로 이어 붙이면 어디까지가 누구 정보인지 안 보였다(2026-10-30 대표님).
  const info: [string, React.ReactNode][] = [
    ["인원", `${people}명`],
    ["금액", app.amount_krw != null ? formatKrw(app.amount_krw) : "-"],
    ["입금자", app.depositor_name || "-"],
    ["신청", formatDateTimeFull(app.created_at)],
  ];
  if (showPromoted && app.promoted_from_waiting_at) {
    info.push(["확정", `대기 → 확정 (${formatDateTimeFull(app.promoted_from_waiting_at)})`]);
  }
  if (cancelled && app.refund_bank_name) {
    info.push([
      "환불 계좌",
      <>
        <strong>{app.refund_bank_name}</strong> {app.refund_account_number} {app.refund_account_holder}
        {app.refund_completed_at && (
          <span className="text-muted"> (완료 {formatDateTimeFull(app.refund_completed_at)})</span>
        )}
      </>,
    ]);
  }
  return (
    <li className="overflow-hidden rounded-xl border border-border">
      {/* ── 신청 건 머리: 접수번호 · 상태 · 액션 ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-fill-subtle px-4 py-3">
        <span className="text-body">
          <ApplicationDetailDialog application={app} attendees={atts} />
        </span>
        {app.status === "waiting" && <span className={`${tag} bg-amber-400 text-black`}>대기</span>}
        {!cancelled &&
          (app.payment_status === "confirmed" ? (
            <span className={`${tag} bg-green-500 text-black`}>입금 확인</span>
          ) : (
            <span className={`${tag} bg-amber-400 text-black`}>입금 전</span>
          ))}
        {cancelled &&
          (app.refund_completed_at ? (
            <span className={`${tag} bg-fill-strong text-muted`}>환불 완료</span>
          ) : needsRefund(app) ? (
            <span className={`${tag} bg-red-500 text-white`}>환불 필요</span>
          ) : (
            <span className={`${tag} bg-fill-strong text-muted`} title="입금 전 취소라 돌려줄 금액이 없습니다">
              환불 없음
            </span>
          ))}
        {app.is_internal && (
          <span
            className={`${tag} border border-amber-400/60 text-amber-400`}
            title="테스트 기기(/internal)에서 넣은 신청 — 분석에서 빠집니다"
          >
            테스트
          </span>
        )}
        <span className="ml-auto">
          {cancelled ? (
            needsRefund(app) &&
            !app.refund_completed_at && <RefundCompleteButton applicationId={app.id} sessionId={session.id} />
          ) : (
            <ApplicationActionMenu
              applicationId={app.id}
              sessionId={session.id}
              status={app.status}
              paymentStatus={app.payment_status}
              minAge={session.min_age ?? 16}
              depositorName={app.depositor_name}
              notes={app.notes}
              attendees={atts.map((a) => ({
                id: a.id,
                is_representative: a.is_representative,
                name: a.name,
                phone: a.phone,
                birth_year: a.birth_year,
                nickname: a.nickname,
                gender: a.gender,
                experience_range: a.experience_range,
              }))}
            />
          )}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* ── 신청 정보 ── */}
        <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body-sm">
          {info.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
        </dl>

        {/* ── 참여자 ── 사람마다 한 줄, 칸을 맞춘다 */}
        <div>
          <p className="mb-1.5 text-label font-semibold text-muted">참여자</p>
          {people > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {atts.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-body-sm sm:grid-cols-[minmax(0,1fr)_3rem_3.5rem_auto]"
                >
                  <span className="min-w-0 font-semibold">
                    {a.is_representative && (
                      <span className="mr-1.5 rounded-md bg-fill px-1.5 py-0.5 text-micro font-normal text-muted">대표</span>
                    )}
                    {a.name}
                    {/* 몇 번째 참여인가 — 운영자 전용(participationHistory.ts). 첫 참여면 안 붙인다. */}
                    {a.revisit && (
                      <span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-micro font-normal text-amber-400">
                        {a.revisit}
                      </span>
                    )}
                  </span>
                  <span className="text-muted">{a.gender === "M" ? "남" : a.gender === "F" ? "여" : "-"}</span>
                  <span className="tabular-nums text-muted">{a.birth_year ?? "-"}</span>
                  <a
                    href={`tel:${a.phone.replace(/[^\d]/g, "")}`}
                    className="col-span-3 tabular-nums text-glow underline sm:col-span-1"
                  >
                    {a.phone}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-muted">참여자 정보 없음</p>
          )}
        </div>
      </div>
    </li>
  );
}

function AppSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-h3 font-semibold">
        {title} <span className="text-muted">{count}</span>
      </h2>
      {children}
    </section>
  );
}

export default async function AdminSessionDetailPage(props: { params: PageProps }) {
  const params = await props.params;
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .single();

  // 표시값(테마명·정원·장소·연령)은 session_display 가 통일해준다.
  // sessions 를 직접 읽으면 신규 회차에서 옛 컬럼이 나온다.
  const { data: display } = await supabase
    .from("session_display")
    .select("*")
    .eq("id", params.id)
    .single();

  const { data: applications, error: applicationsError } = await supabase
    .from("admin_application_view")
    .select("*")
    .eq("session_id", params.id)
    .order("created_at", { ascending: false });

  const { data: attendees, error: attendeesError } = await supabase
    .from("admin_attendee_view")
    .select("*")
    .eq("session_id", params.id);

  if (!session) {
    return (
      <div className="p-6">
        <div className="text-red-500">세션을 찾을 수 없습니다.</div>
      </div>
    );
  }

  if (applicationsError || attendeesError) {
    return (
      <div className="p-6">
        <div className="text-red-500">
          신청자 목록을 불러올 수 없습니다:{" "}
          {applicationsError?.message || attendeesError?.message}
        </div>
      </div>
    );
  }

  const stats = await getSessionStats(session.id).catch((err) => {
    console.error(`[admin] 세션 통계 조회 실패: ${session.id}`, err);
    return null;
  });

  const unpaidConfirmedCount = countUnpaidConfirmed(applications ?? [], attendees ?? []).get(session.id) ?? 0;

  // 우리 기기에서 넣은 신청에 '테스트' 배지를 단다. 정원·명단에는 그대로 포함된다.
  const internalIds = await getInternalApplicationIds((applications ?? []).map((a) => a.id as string));
  // 금액은 admin_application_view 에 없어 표에서 따로 읽는다.
  const { data: amountRows } = await supabase.from("applications").select("id, amount_krw").eq("session_id", params.id);
  const amountById = new Map(((amountRows ?? []) as { id: string; amount_krw: number | null }[]).map((r) => [r.id, r.amount_krw]));
  const allApplications: App[] = (applications ?? []).map((a) => ({
    ...(a as Omit<App, "is_internal" | "amount_krw">),
    amount_krw: amountById.get(a.id as string) ?? null,
    is_internal: internalIds.has(a.id as string),
  }));

  // 참여자별 '몇 번째 참여인가'(노말은 재참여 무제한). 운영자 화면에서만 보인다.
  const history = await getParticipationHistory(allApplications.map((a) => a.id as string));
  const attendeesWithVisit: Att[] = (attendees ?? []).map((a) => ({
    ...(a as Omit<Att, "revisit">),
    revisit: revisitLabel(history.get(a.id as string)),
  }));
  const attsOf = (appId: string) => attendeesWithVisit.filter((a) => a.application_id === appId);

  // 입금 전 건이 위로 오도록 정렬 (동순위는 기존 created_at desc 순서 유지, Array#sort는 안정 정렬).
  const confirmedApps = allApplications
    .filter((a) => a.status === "confirmed")
    .sort((a, b) => (a.payment_status === "confirmed" ? 1 : 0) - (b.payment_status === "confirmed" ? 1 : 0));

  const waitingApps = allApplications.filter((a) => a.status === "waiting");

  // 환불 미완료 건이 위로 오도록 정렬.
  const cancelledApps = allApplications
    .filter((a) => a.status === "cancelled")
    // 실제로 처리할 게 있는 건(입금했는데 환불 미완료)이 맨 위로 온다.
    .sort((a, b) => {
      const rank = (x: App) =>
        needsRefund(x) && !x.refund_completed_at ? 0 : x.refund_completed_at ? 1 : 2;
      return rank(a) - rank(b);
    });

  // 노말모드는 한 팀만 받는다 — 확정 · 대기 대신 예약 인원과 입금 상태로 본다(2026-10-30 대표님).
  const isNormal = Boolean(display?.theme_mode?.includes("노말"));
  const bookedPeople = confirmedApps.reduce((n, a) => n + attsOf(a.id).length, 0);
  const refundTodo = cancelledApps.filter((a) => needsRefund(a) && !a.refund_completed_at).length;
  const pendingOpen = session.opens_at && new Date(session.opens_at).getTime() > getNowMs();
  const state =
    session.status === "cancelled"
      ? { label: "비활성화", cls: "bg-red-500 text-white" }
      : pendingOpen
        ? { label: "공개 전", cls: "bg-amber-400 text-black" }
        : session.status === "open"
          ? { label: "모집중", cls: "bg-glow text-black" }
          : { label: "마감", cls: "bg-zinc-500 text-white" };
  const cards = (apps: App[], showPromoted = false) => (
    <ul className="flex flex-col gap-3">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} atts={attsOf(app.id)} session={session} showPromoted={showPromoted} />
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-4 inline-block text-body-sm text-glow hover:underline">
          ← 대시보드
        </Link>

        {/* ── 회차 머리 ── 언제 · 무엇 · 지금 상태를 한눈에, 버튼은 한 줄로 */}
        <header className="mb-8 rounded-xl border border-border p-4 md:p-5">
          <p className="text-h2 font-semibold tabular-nums">{formatDateTimeFull(session.start_at)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/*
              ⚠️ 테마명·모드는 session_display 에서 읽는다. sessions 의 theme_name ·
                 session_type · theme_mode 는 옛 회차 칸이라 새 구조 회차에서는 비어 있어,
                 제목에 날짜만 남았다(2026-10-18).
            */}
            <span className="text-body font-semibold">
              {display?.theme_name ?? `${session.session_type ?? ""} ${session.theme_name ?? ""}`.trim()}
            </span>
            {/* 테마명이 두 모드 모두 '바-ㅇ탈출' 이라, 모드 배지가 없으면 파티인지 노말인지 알 수 없다. */}
            {display?.theme_mode && (
              <span className="rounded-md bg-muted/20 px-2 py-0.5 text-micro text-muted">{display.theme_mode}</span>
            )}
            <span className={`${tag} ${state.cls}`}>{state.label}</span>
          </div>
          <p className="mt-2 text-body text-muted">
            {isNormal
              ? confirmedApps.length > 0
                ? `예약 ${bookedPeople}명 · ${unpaidConfirmedCount > 0 ? "입금 확인 전" : "입금 확인"}`
                : "예약 없음"
              : `${display && stats ? formatHeadcountLine(display as SessionDisplayRow, stats) : ""} · 입금 확인 전 ${unpaidConfirmedCount}명`}
          </p>
          {session.status !== "cancelled" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SessionStatusToggle
                sessionId={session.id}
                status={session.status}
                label={formatDateTimeFull(session.start_at)}
                size="md"
              />
              <ManualApplyButton
                sessionId={session.id}
                isDatingSession={isDatingTheme(session.session_type)}
                minAge={session.min_age ?? 16}
              />
              <SendReminderButton sessionId={session.id} />
            </div>
          )}
        </header>

        <AppSection title={isNormal ? "예약" : "확정"} count={confirmedApps.length}>
          {confirmedApps.length > 0 ? (
            cards(confirmedApps, !isNormal)
          ) : (
            <p className="rounded-lg border border-border p-6 text-center text-body-sm text-muted">
              {isNormal ? "아직 예약이 없습니다." : "확정된 신청이 없습니다."}
            </p>
          )}
        </AppSection>

        {/* 대기는 거의 생기지 않는다 — 있을 때만 보인다(2026-10-30 대표님). */}
        {waitingApps.length > 0 && (
          <AppSection title="대기" count={waitingApps.length}>
            {cards(waitingApps)}
          </AppSection>
        )}

        {cancelledApps.length > 0 && (
          // 취소는 접어 둔다. 환불할 건이 남아 있으면 펼쳐 둔다.
          <details open={refundTodo > 0} className="group mb-8">
            <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-h3 font-semibold [&::-webkit-details-marker]:hidden">
              취소 <span className="text-muted">{cancelledApps.length}</span>
              {refundTodo > 0 && <span className={`${tag} bg-red-500 text-white`}>환불 필요 {refundTodo}</span>}
              <Chevron dir="down" className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
            </summary>
            {cards(cancelledApps)}
          </details>
        )}

        {/* 되돌리기 어려운 버튼은 맨 아래로 — 자주 누르는 버튼 사이에 두면 잘못 누른다. */}
        {session.status !== "cancelled" && (
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <p className="text-micro text-muted">최소 인원 미달 등으로 회차를 열지 않을 때</p>
            <DeactivateSessionButton sessionId={session.id} />
          </div>
        )}
      </div>
    </div>
  );
}
