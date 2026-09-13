import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

/**
 * 감사로그 — 어드민이 무엇을 언제 했는지.
 *
 * 되돌릴 수 없는 액션(입금확인·취소·환불완료·쿠폰 발송·회차 비활성화 등)이
 * 아무 기록도 남기지 않던 것을 2026-09-12 에 보완했다.
 * 설계 근거: docs/09-implementation-roadmap.md Phase 7
 *
 * ⚠️ **누가** 했는지는 계정 단위로 알 수 없다. 어드민 인증이 공유 비밀번호
 *    하나라 사람을 구분할 계정이 없다. IP·브라우저로 기기 정도만 구분된다.
 */

const PAGE_SIZE = 200;

/** 액션 코드를 사람이 읽는 말로. 목록에서 한눈에 분류되도록 한다. */
const ACTION_LABEL: Record<string, string> = {
  "application.payment_confirmed": "입금 확인",
  "application.cancelled": "신청 취소(문자 발송)",
  "application.cancelled_silent": "신청 취소(문자 없음)",
  "application.promoted": "대기 → 확정",
  "application.refund_completed": "환불 완료",
  "application.manual_created": "수동 등록",
  "application.updated": "신청 정보 수정",
  "session.deactivated": "회차 비활성화",
  "session.reminder_sent": "장소안내 발송",
  "session.status_changed": "회차 상태 변경",
  "session.min_age_changed": "최소 연령 변경",
  "session.deleted": "회차 삭제",
  "schedule.saved": "회차 편성 저장",
  "coupon.sent": "쿠폰 문자 발송",
  "coupon.issued": "쿠폰 발행",
  "coupon.campaign_saved": "쿠폰 종류 저장",
  "coupon.campaign_deleted": "쿠폰 종류 삭제",
  "coupon.deleted": "쿠폰 삭제",
  "theme.saved": "테마 저장",
  "theme.deleted": "테마 삭제",
  "venue.saved": "장소 저장",
  "venue.deleted": "장소 삭제",
  "notice.saved": "공지 저장",
  "notice.deleted": "공지 삭제",
  "faq.saved": "FAQ 저장",
  "faq.deleted": "FAQ 삭제",
  "sms_template.updated": "문자 포맷 수정",
  "slack_template.updated": "슬랙 포맷 수정",
};

/** 되돌리기 어렵거나 고객에게 문자가 나가는 액션은 눈에 띄게 한다. */
const HEAVY = new Set([
  "application.cancelled",
  "application.cancelled_silent",
  "application.refund_completed",
  "session.deactivated",
  "session.deleted",
  "coupon.sent",
  "theme.deleted",
  "venue.deleted",
  "sms_template.updated",
]);

type AuditRow = {
  id: number;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export default async function AuditLogPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/audit" />

        <h1 className="mb-1 text-2xl font-bold">감사로그</h1>
        <p className="mb-6 text-sm text-muted">
          어드민에서 실행한 되돌리기 어려운 작업의 기록입니다. 최근 {PAGE_SIZE}건까지 보여줍니다.
          {" "}
          <span className="text-amber-400">
            어드민이 공유 비밀번호라 &lsquo;누가&rsquo;는 사람 단위로 구분되지 않습니다(IP·브라우저만 기록).
          </span>
        </p>

        {error ? (
          <div className="text-red-400">불러올 수 없습니다: {error.message}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border p-10 text-center">
            <p className="font-semibold">아직 기록이 없습니다.</p>
            <p className="mt-2 text-sm text-muted">
              입금 확인·취소·환불 완료 같은 작업을 하면 여기에 쌓입니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[56rem] text-left">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">시각</th>
                  <th className="px-4 py-3 font-medium">작업</th>
                  <th className="px-4 py-3 font-medium">내용</th>
                  <th className="px-4 py-3 font-medium">대상</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ip = typeof r.detail?.ip === "string" ? r.detail.ip : "-";
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                        {formatDateTimeFull(r.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span className={HEAVY.has(r.action) ? "font-semibold text-amber-400" : ""}>
                          {ACTION_LABEL[r.action] ?? r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{r.summary ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                        {r.target_type}
                        <br />
                        <span className="font-mono">{r.target_id.slice(0, 8)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
