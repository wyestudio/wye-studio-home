import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSessionDateTime } from "@/lib/format";
import { ConfirmPaymentButton } from "./ConfirmPaymentButton";

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

  const { data: applications } = await supabase
    .from("applications")
    .select(
      `
      id, session_id, confirmation_code, status, payment_status, created_at,
      application_attendees(id, name_enc, phone_enc, is_representative, gender)
    `
    )
    .eq("session_id", params.id)
    .order("created_at", { ascending: false });

  if (!session) {
    return (
      <div className="p-6">
        <div className="text-red-500">세션을 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin-x7f9k2m3" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{session.title}</h1>
          <p className="text-muted">{formatSessionDateTime(session.start_at)}</p>
          <p className="text-sm text-muted mt-1">정원: {session.capacity_max}명</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-sm">접수번호</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">참여자</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">신청 상태</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">입금 상태</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">액션</th>
              </tr>
            </thead>
            <tbody>
              {applications && applications.length > 0 ? (
                applications.map((app) => (
                  <tr key={app.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-4 text-sm font-mono text-glow">{app.confirmation_code}</td>
                    <td className="py-3 px-4 text-sm">
                      {app.application_attendees && app.application_attendees.length > 0 ? (
                        <div className="space-y-1">
                          {app.application_attendees.map((att: any, idx: number) => (
                            <div key={idx} className="text-xs">
                              {att.is_representative && <span className="font-semibold">대표 </span>}
                              [{att.phone_enc ? "***-****-****" : "정보없음"}]
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
                            : "text-yellow-500 font-semibold"
                        }
                      >
                        {app.status === "confirmed" ? "확정" : "대기"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={
                          app.payment_status === "confirmed"
                            ? "text-green-500 font-semibold"
                            : "text-muted"
                        }
                      >
                        {app.payment_status === "confirmed" ? "입금 확인" : "대기중"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {app.payment_status !== "confirmed" && app.status === "confirmed" && (
                        <ConfirmPaymentButton
                          applicationId={app.id}
                          sessionId={session.id}
                          confirmationCode={app.confirmation_code}
                        />
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-muted">
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
