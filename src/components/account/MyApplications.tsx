import Link from "next/link";
import { formatKrw } from "@/lib/format";

export type MyApplication = {
  id: string;
  confirmation_code: string;
  status: "confirmed" | "waiting" | "cancelled";
  payment_status: "pending" | "confirmed" | "cancelled";
  headcount: number;
  amount_krw: number | null;
  discount_krw: number;
  start_at: string;
  theme_name: string | null;
  format_label: string | null;
  venue_area: string | null;
  theme_slug: string | null;
};

const kst = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

const STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "확정", tone: "text-glow" },
  waiting: { label: "대기", tone: "text-sky-400" },
  cancelled: { label: "취소", tone: "text-muted" },
};

/**
 * 내 참여 이력.
 *
 * 비회원으로 냈던 신청도 전화번호가 같으면 가입 시 자동으로 붙는다
 * (upsert_profile_and_link). 단 본인이 대표로 낸 건만 — 동행자로 이름이
 * 올라간 건은 그 사람이 낸 신청이 아니다.
 */
export function MyApplications({ applications }: { applications: MyApplication[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-muted">참여 이력</h2>

      {applications.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          아직 참여 내역이 없어요.
          <br />
          <Link href="/contents" className="mt-2 inline-block text-glow underline">
            테마 보러 가기
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((a) => {
            const s = STATUS[a.status] ?? STATUS.cancelled;
            return (
              <li key={a.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {a.theme_name ?? "테마"}
                      {a.format_label && (
                        <span className="ml-1.5 text-xs font-normal text-muted">
                          {a.format_label}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{kst(a.start_at)}</p>
                    {a.venue_area && <p className="text-xs text-muted">{a.venue_area}</p>}
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${s.tone}`}>{s.label}</span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                  <span className="text-muted">
                    접수번호 <span className="font-mono">{a.confirmation_code}</span> · {a.headcount}명
                  </span>
                  <span>
                    {a.amount_krw != null ? formatKrw(a.amount_krw) : "-"}
                    {a.discount_krw > 0 && (
                      <span className="ml-1 text-glow">(쿠폰 {formatKrw(a.discount_krw)})</span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
