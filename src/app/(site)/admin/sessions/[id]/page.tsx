import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSessionDateTime } from "@/lib/format";
import { DeactivateSessionButton } from "./DeactivateSessionButton";
import { SendReminderButton } from "./SendReminderButton";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";
import { ApplicationActionMenu } from "./ApplicationActionMenu";
import { getSessionStats } from "@/lib/sessions";
import { formatCapacityLine, formatHeadcountLine } from "@/lib/sessionStatsFormat";

export const dynamic = "force-dynamic";

type PageProps = Promise<{ id: string }>;

export default async function AdminSessionDetailPage(props: { params: PageProps }) {
  const params = await props.params;
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("sessions")
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

  const unpaidConfirmedCount = (applications ?? [])
    .filter((app: any) => app.status === "confirmed" && app.payment_status !== "confirmed")
    .reduce(
      (sum: number, app: any) => sum + (attendees ?? []).filter((a: any) => a.application_id === app.id).length,
      0
    );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {session.session_type} {session.theme_name}
            </h1>
            <p className="text-muted">{formatSessionDateTime(session.start_at)}</p>
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
              <SendReminderButton sessionId={session.id} />
              <DeactivateSessionButton sessionId={session.id} />
            </div>
          )}
        </div>

        {stats && (
          <div className="mb-8 rounded-lg border border-border p-4 space-y-1.5">
            <p className="text-xl font-semibold text-foreground">{formatCapacityLine(session)}</p>
            <p className="text-xl font-semibold text-foreground">{formatHeadcountLine(stats)}</p>
            <p className="text-xl font-semibold text-foreground">입금 확인 전 인원: {unpaidConfirmedCount}명</p>
          </div>
        )}

        <p className="text-sm text-muted mb-2">💡 접수번호를 클릭하면 신청 상세 정보를 확인할 수 있습니다.</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-sm">접수번호</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">참여자</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">성별</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">출생년도</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">신청 상태</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">입금 상태</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">환불</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">액션</th>
              </tr>
            </thead>
            <tbody>
              {applications && applications.length > 0 ? (
                applications.map((app: any) => {
                  const appAttendees = attendees?.filter((a: any) => a.application_id === app.id) || [];
                  return (
                    <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30">
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
                      <td className="py-3 px-4 text-sm">
                        {app.status === "cancelled" && app.refund_bank_name && (
                          <div className="text-xs space-y-0.5">
                            <p><strong>{app.refund_bank_name}</strong></p>
                            <p>{app.refund_account_number}</p>
                            <p>{app.refund_account_holder}</p>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <ApplicationActionMenu
                          applicationId={app.id}
                          sessionId={session.id}
                          status={app.status}
                          paymentStatus={app.payment_status}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-muted">
                    신청이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
