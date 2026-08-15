import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSessionDateTime } from "@/lib/format";
import { ConfirmPaymentButton } from "./ConfirmPaymentButton";
import { CancelApplicationButton } from "./CancelApplicationButton";
import { PromoteWaitlistButton } from "./PromoteWaitlistButton";
import { DeactivateSessionButton } from "./DeactivateSessionButton";

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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{session.title}</h1>
            <p className="text-muted">{formatSessionDateTime(session.start_at)}</p>
            <p className="text-sm text-muted mt-1">정원: {session.capacity_max}명</p>
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
          {session.status !== "cancelled" && <DeactivateSessionButton sessionId={session.id} />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-sm">접수번호</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">참여자</th>
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
                      <td className="py-3 px-4 text-sm font-mono text-glow">{app.confirmation_code}</td>
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
                        <div className="flex flex-col items-start gap-1">
                          {app.payment_status !== "confirmed" && app.status === "confirmed" && (
                            <ConfirmPaymentButton
                              applicationId={app.id}
                              sessionId={session.id}
                              confirmationCode={app.confirmation_code}
                            />
                          )}
                          {app.status === "waiting" && (
                            <PromoteWaitlistButton applicationId={app.id} sessionId={session.id} />
                          )}
                          {app.status !== "cancelled" && (
                            <CancelApplicationButton applicationId={app.id} sessionId={session.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-muted">
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
