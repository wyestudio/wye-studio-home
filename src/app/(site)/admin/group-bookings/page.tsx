import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeFull } from "@/lib/format";
import {
  INQUIRY_STATUSES,
  contactMethodLabel,
  groupKindLabel,
  preferredTimeLabel,
} from "@/lib/groupBooking";
import { InquiryRow } from "./InquiryRow";

export const dynamic = "force-dynamic";

/**
 * 단체 예약 문의 접수함.
 *
 * ⚠️ 이 화면에는 **복호화된 연락처가 그대로 보인다.** 슬랙 알림에 연락처를 싣지 않는
 *    이유가 이것이다 — 개인정보는 어드민 로그인을 거친 이 화면에서만 보여야 한다.
 *
 * 접수는 예약이 아니다. 상태(접수 → 연락 완료 → 견적 안내 → 예약 확정)로 어디까지
 * 응대했는지 적어 둬야 둘이 나눠 볼 때 겹치지 않는다.
 */
type Inquiry = {
  id: string;
  created_at: string;
  headcount: number;
  contact_method: string;
  contact: string;
  preferred_date: string | null;
  preferred_time: string;
  group_kind: string;
  note: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  status: string;
  admin_memo: string | null;
};

const th = "px-3 py-3 text-left text-sm font-semibold";
const td = "px-3 py-3 align-top text-sm";

export default async function AdminGroupBookingsPage() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("admin_group_booking_inquiries_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">단체 예약 문의를 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }

  const rows = (data as Inquiry[]) ?? [];
  // 아직 아무도 손대지 않은 건수. 접수함은 "오늘 볼 게 몇 건인가" 가 먼저다.
  const pending = rows.filter((r) => r.status === "new").length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="mb-4 inline-block text-glow hover:underline">
          ← 돌아가기
        </Link>

        <h1 className="mb-2 text-3xl font-bold">단체 예약 문의</h1>
        <p className="mb-8 text-sm text-muted">
          전체 {rows.length}건 · 미응대 {pending}건 ·{" "}
          <Link href="/group" className="text-glow hover:underline">
            고객 화면(/group)
          </Link>
        </p>

        {rows.length === 0 ? (
          <p className="py-4 text-muted">아직 접수된 문의가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={th}>접수일시</th>
                  <th className={th}>인원</th>
                  <th className={th}>희망 일시</th>
                  <th className={th}>모임</th>
                  <th className={th}>연락처</th>
                  <th className={th}>요청사항</th>
                  <th className={th}>유입</th>
                  <th className={th}>진행 상태 · 메모</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/50 ${
                      r.status === "new" ? "bg-brand-soft/30" : ""
                    }`}
                  >
                    <td className={`${td} whitespace-nowrap text-xs`}>
                      {formatDateTimeFull(r.created_at)}
                    </td>
                    <td className={`${td} whitespace-nowrap font-bold`}>{r.headcount}명</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.preferred_date ?? <span className="text-muted">날짜 미정</span>}
                      <br />
                      <span className="text-xs text-muted">
                        {preferredTimeLabel(r.preferred_time)}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{groupKindLabel(r.group_kind)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <span className="text-xs text-muted">
                        {contactMethodLabel(r.contact_method)}
                      </span>
                      <br />
                      {r.contact}
                    </td>
                    <td className={`${td} max-w-[280px] whitespace-pre-line`}>
                      {r.note || <span className="text-muted">-</span>}
                    </td>
                    <td className={`${td} max-w-[180px] text-xs text-muted`}>
                      {/* 빈 칸이 곧 '직접 방문' 이다 — 그 말을 직접 적어 둔다. */}
                      {r.utm_source || r.referrer ? (
                        <>
                          {r.utm_source && (
                            <div>
                              {r.utm_source}
                              {r.utm_medium ? ` / ${r.utm_medium}` : ""}
                            </div>
                          )}
                          {r.utm_campaign && <div>{r.utm_campaign}</div>}
                          {r.referrer && <div className="break-all">{r.referrer}</div>}
                          {r.landing_path && <div className="break-all">{r.landing_path}</div>}
                        </>
                      ) : (
                        "직접 방문"
                      )}
                    </td>
                    <td className={td}>
                      <InquiryRow id={r.id} status={r.status} memo={r.admin_memo ?? ""} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-8 text-xs leading-relaxed text-muted">
          진행 상태: {INQUIRY_STATUSES.map((s) => s.label).join(" → ")}
        </p>
      </div>
    </div>
  );
}
