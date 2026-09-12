import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { DeactivateSessionButton } from "./DeactivateSessionButton";
import { SessionStatusToggle } from "@/components/admin/SessionStatusToggle";
import { SendReminderButton } from "./SendReminderButton";
import { ManualApplyButton } from "./ManualApplyButton";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";
import { ApplicationActionMenu } from "./ApplicationActionMenu";
import { RefundCompleteButton } from "./RefundCompleteButton";
import { getSessionStats } from "@/lib/sessions";
import {
  formatCapacityLine,
  formatHeadcountLine,
  countUnpaidConfirmed,
  type SessionDisplayRow,
} from "@/lib/sessionStatsFormat";
import { isDatingTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

type PageProps = Promise<{ id: string }>;

function CommonCells({ app, appAttendees }: { app: any; appAttendees: any[] }) {
  return (
    <>
      <td className="py-3 px-4 text-sm">
        <ApplicationDetailDialog application={app} attendees={appAttendees} />
      </td>
      <td className="py-3 px-4 text-sm">
        {appAttendees.length > 0 ? (
          <div className="space-y-1">
            {appAttendees.map((att: any, idx: number) => (
              <div key={idx} className="text-xs">
                {att.is_representative && <span className="font-semibold">대표 </span>}
                {att.name} [{att.phone}]
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted">참여자 정보 없음</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        {appAttendees.length > 0 ? (
          <div className="space-y-1">
            {appAttendees.map((att: any, idx: number) => (
              <div key={idx} className="text-xs">
                {att.gender === "M" ? "남" : att.gender === "F" ? "여" : "-"}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        {appAttendees.length > 0 ? (
          <div className="space-y-1">
            {appAttendees.map((att: any, idx: number) => (
              <div key={idx} className="text-xs">
                {att.birth_year ?? "-"}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
    </>
  );
}

function StatusCell({ app }: { app: any }) {
  return (
    <td className="py-3 px-4 text-sm">
      <span
        className={
          app.status === "confirmed"
            ? "text-green-500 font-semibold"
            : app.status === "cancelled"
              ? "text-red-500 font-semibold"
              : "text-yellow-500 font-semibold"
        }
      >
        {app.status === "confirmed" ? "확정" : app.status === "cancelled" ? "취소" : "대기"}
      </span>
    </td>
  );
}

function PromotedCell({ app }: { app: any }) {
  return (
    <td className="py-3 px-4 text-sm">
      {app.promoted_from_waiting_at ? (
        <span className="text-glow font-semibold">
          대기→확정 <span className="text-xs text-muted">({formatDateTimeFull(app.promoted_from_waiting_at)})</span>
        </span>
      ) : (
        <span className="text-muted">즉시확정</span>
      )}
    </td>
  );
}

function PaymentStatusCell({ app }: { app: any }) {
  return (
    <td className="py-3 px-4 text-sm">
      <span
        className={
          app.payment_status === "confirmed"
            ? "text-green-500 font-semibold"
            : app.payment_status === "cancelled"
              ? "text-red-500 font-semibold"
              : "text-muted"
        }
      >
        {app.payment_status === "confirmed" ? "입금 확인" : app.payment_status === "cancelled" ? "취소됨" : "대기중"}
      </span>
    </td>
  );
}

function ActionCell({
  app,
  appAttendees,
  session,
}: {
  app: any;
  appAttendees: any[];
  session: { id: string; session_type: string };
}) {
  return (
    <td className="py-3 px-4 text-sm">
      <ApplicationActionMenu
        applicationId={app.id}
        sessionId={session.id}
        status={app.status}
        paymentStatus={app.payment_status}
        isDatingSession={isDatingTheme(session.session_type)}
        depositorName={app.depositor_name}
        notes={app.notes}
        attendees={appAttendees.map((a: any) => ({
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
    </td>
  );
}

/**
 * 이 취소 건에 돌려줄 돈이 있는가.
 *
 * 취소되면 payment_status 가 'cancelled' 로 덮여 입금 여부를 잃는다.
 * 대신 입금확인 문자 발송 시각(payment_confirmed_sms_sent_at)이 남아 있어
 * "입금까지 갔던 건" 인지 판별할 수 있다.
 *
 * 이걸 구분하지 않으면 입금 전 단순 취소까지 전부 "환불 미완료" 로 보여
 * 처리할 게 없는데도 처리 대기처럼 쌓인다.
 */
function needsRefund(app: any): boolean {
  return Boolean(app.payment_confirmed_sms_sent_at) || Boolean(app.refund_bank_name);
}

function RefundActionCell({ app, sessionId }: { app: any; sessionId: string }) {
  return (
    <td className="py-3 px-4 text-sm">
      {needsRefund(app) && !app.refund_completed_at && (
        <RefundCompleteButton applicationId={app.id} sessionId={sessionId} />
      )}
    </td>
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

  const allApplications = applications ?? [];

  // 입금 전 건이 위로 오도록 정렬 (동순위는 기존 created_at desc 순서 유지, Array#sort는 안정 정렬).
  const confirmedApps = allApplications
    .filter((a: any) => a.status === "confirmed")
    .sort((a: any, b: any) => (a.payment_status === "confirmed" ? 1 : 0) - (b.payment_status === "confirmed" ? 1 : 0));

  const waitingApps = allApplications.filter((a: any) => a.status === "waiting");

  // 환불 미완료 건이 위로 오도록 정렬.
  const cancelledApps = allApplications
    .filter((a: any) => a.status === "cancelled")
    // 실제로 처리할 게 있는 건(입금했는데 환불 미완료)이 맨 위로 온다.
    .sort((a: any, b: any) => {
      const rank = (x: any) =>
        needsRefund(x) && !x.refund_completed_at ? 0 : x.refund_completed_at ? 1 : 2;
      return rank(a) - rank(b);
    });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {session.session_type} {session.theme_name}
            </h1>
            <p className="text-muted">{formatDateTimeFull(session.start_at)}</p>
            <p className="text-sm mt-1">
              상태:{" "}
              <span
                className={
                  session.status === "open"
                    ? "text-glow"
                    : session.status === "cancelled"
                      ? "text-red-500 font-semibold"
                      : "text-muted"
                }
              >
                {session.status === "open" ? "모집중" : session.status === "cancelled" ? "비활성화(취소)" : "마감"}
              </span>
            </p>
          </div>
          {session.status !== "cancelled" && (
            <div className="flex flex-col items-end gap-2">
              <SessionStatusToggle
                sessionId={session.id}
                status={session.status}
                label={formatDateTimeFull(session.start_at)}
                size="md"
              />
              <ManualApplyButton sessionId={session.id} isDatingSession={isDatingTheme(session.session_type)} />
              <SendReminderButton sessionId={session.id} />
              <DeactivateSessionButton sessionId={session.id} />
            </div>
          )}
        </div>

        {stats && (
          <div className="mb-8 rounded-lg border border-border p-4 space-y-1.5">
            <p className="text-xl font-semibold text-foreground">
              {display ? formatCapacityLine(display as SessionDisplayRow) : "정원: -"}
            </p>
            <p className="text-xl font-semibold text-foreground">
              {display ? formatHeadcountLine(display as SessionDisplayRow, stats) : ""}
            </p>
            <p className="text-xl font-semibold text-foreground">입금 확인 전 인원: {unpaidConfirmedCount}명</p>
          </div>
        )}

        <p className="text-sm text-muted mb-2">💡 접수번호를 클릭하면 신청 상세 정보를 확인할 수 있습니다.</p>

        {/* 확정 목록 — 입금 전 건이 위로 오도록 정렬 */}
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-3">확정 목록 ({confirmedApps.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-sm">접수번호</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">참여자</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">성별</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">출생년도</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">신청 상태</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">확정 경위</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">입금 상태</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">액션</th>
                </tr>
              </thead>
              <tbody>
                {confirmedApps.length > 0 ? (
                  confirmedApps.map((app: any) => {
                    const appAttendees = attendees?.filter((a: any) => a.application_id === app.id) || [];
                    return (
                      <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30">
                        <CommonCells app={app} appAttendees={appAttendees} />
                        <StatusCell app={app} />
                        <PromotedCell app={app} />
                        <PaymentStatusCell app={app} />
                        <ActionCell app={app} appAttendees={appAttendees} session={session} />
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-muted">
                      확정된 신청이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 대기 목록 */}
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-3">대기 목록 ({waitingApps.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-sm">접수번호</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">참여자</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">성별</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">출생년도</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">신청 상태</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">액션</th>
                </tr>
              </thead>
              <tbody>
                {waitingApps.length > 0 ? (
                  waitingApps.map((app: any) => {
                    const appAttendees = attendees?.filter((a: any) => a.application_id === app.id) || [];
                    return (
                      <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30">
                        <CommonCells app={app} appAttendees={appAttendees} />
                        <StatusCell app={app} />
                        <ActionCell app={app} appAttendees={appAttendees} session={session} />
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted">
                      대기 중인 신청이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 취소 목록 — 환불 미완료 건이 위로 오도록 정렬 */}
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-3">취소 목록 ({cancelledApps.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-sm">접수번호</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">참여자</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">성별</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">출생년도</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">신청 상태</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">환불계좌</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">환불 여부</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">액션</th>
                </tr>
              </thead>
              <tbody>
                {cancelledApps.length > 0 ? (
                  cancelledApps.map((app: any) => {
                    const appAttendees = attendees?.filter((a: any) => a.application_id === app.id) || [];
                    return (
                      <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30">
                        <CommonCells app={app} appAttendees={appAttendees} />
                        <StatusCell app={app} />
                        <td className="py-3 px-4 text-sm">
                          {app.refund_bank_name && (
                            <div className="text-xs space-y-0.5">
                              <p><strong>{app.refund_bank_name}</strong></p>
                              <p>{app.refund_account_number}</p>
                              <p>{app.refund_account_holder}</p>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {app.refund_completed_at ? (
                            <span className="text-green-500 font-semibold">
                              완료 <span className="text-xs text-muted">({formatDateTimeFull(app.refund_completed_at)})</span>
                            </span>
                          ) : needsRefund(app) ? (
                            <span className="text-yellow-500 font-semibold">미완료</span>
                          ) : (
                            <span className="text-muted" title="입금 전 취소라 돌려줄 금액이 없습니다">
                              환불 없음
                            </span>
                          )}
                        </td>
                        <RefundActionCell app={app} sessionId={session.id} />
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-muted">
                      취소된 신청이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
