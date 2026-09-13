import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { formatKrw, formatDateTimeFull, formatDateFull } from "@/lib/format";
import { ApplicationFilters } from "./ApplicationFilters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  id: string;
  confirmation_code: string;
  status: "confirmed" | "waiting" | "cancelled";
  payment_status: "pending" | "confirmed" | "cancelled";
  headcount: number;
  amount_krw: number | null;
  created_at: string;
  session_id: string;
  session_start_at: string;
  theme_name: string | null;
  format_label: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  depositor_name: string | null;
  total_count: number;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "확정",
  waiting: "대기",
  cancelled: "취소",
};
const PAYMENT_LABEL: Record<string, string> = {
  pending: "입금 전",
  confirmed: "입금 완료",
  cancelled: "취소",
};

function statusTone(status: string): string {
  if (status === "confirmed") return "text-glow";
  if (status === "waiting") return "text-sky-400";
  return "text-muted";
}

/** 전화번호 뒤 4자리만 노출한다. 목록에서 전체 번호를 흘릴 이유가 없다. */
function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `···${d.slice(-4)}` : "-";
}

export default async function AdminApplicationsPage({
  searchParams,
}: PageProps<"/admin/applications">) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  const query = get("q");
  const status = get("status");
  const payment = get("payment");
  const sessionId = get("session");
  const page = Math.max(1, Number(get("page") ?? 1) || 1);

  const supabase = createAdminClient();

  const [rowsRes, sessionsRes] = await Promise.all([
    supabase.rpc("admin_search_applications", {
      p_query: query ?? null,
      p_session_id: sessionId ?? null,
      p_status: status ?? null,
      p_payment: payment ?? null,
      p_from: null,
      p_to: null,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    // 테마명이 붙은 session_display 를 쓴다 — 필터가 테마로 먼저 좁히기 때문이다.
    supabase
      .from("session_display")
      .select("id, start_at, theme_id, theme_name, format_label")
      .order("start_at", { ascending: false }),
  ]);

  if (rowsRes.error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/applications" />
          <div className="text-red-400">신청 목록을 불러올 수 없습니다: {rowsRes.error.message}</div>
        </div>
      </div>
    );
  }

  const rows = (rowsRes.data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 필터는 테마 → 날짜(달력) → 시각 순으로 좁힌다. 그래서 테마와 시작 시각을
  // 같이 넘긴다 (롤링 오픈으로 회차가 150개 가까워 한 줄 목록으로는 못 고른다).
  const sessionOptions = (sessionsRes.data ?? []).map((s) => ({
    id: s.id as string,
    start_at: s.start_at as string,
    theme_id: (s.theme_id as string | null) ?? null,
    theme_name: (s.theme_name as string | null) ?? "(테마 없음)",
    note: (s.format_label as string | null) ?? null,
  }));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/applications" />

        <header className="mb-5">
          <h1 className="text-2xl font-bold">신청 목록</h1>
          <p className="mt-1 text-sm text-muted">
            모든 회차의 신청을 한 곳에서 찾습니다. 접수번호·이름·입금자명·전화번호로 검색할 수 있어요.
          </p>
        </header>

        <ApplicationFilters sessions={sessionOptions} />

        <p className="mb-3 text-sm text-muted">
          총 <strong className="text-foreground">{total}</strong>건
          {totalPages > 1 && ` · ${page} / ${totalPages} 페이지`}
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border py-16 text-center text-sm text-muted">
            조건에 맞는 신청이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2.5">접수번호</th>
                  <th className="px-3 py-2.5">신청자</th>
                  <th className="px-3 py-2.5">인원</th>
                  <th className="px-3 py-2.5">회차</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">입금</th>
                  <th className="px-3 py-2.5 text-right">금액</th>
                  <th className="px-3 py-2.5">신청일</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 font-mono">{r.confirmation_code}</td>
                    <td className="px-3 py-2.5">
                      {r.representative_name ?? "-"}
                      <span className="ml-1.5 text-xs text-muted">{maskPhone(r.representative_phone)}</span>
                      {r.depositor_name && r.depositor_name !== r.representative_name && (
                        <span className="ml-1.5 text-xs text-amber-400" title="입금자명이 신청자와 다릅니다">
                          입금 {r.depositor_name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{r.headcount}명</td>
                    <td className="px-3 py-2.5 text-xs">
                      {formatDateTimeFull(r.session_start_at)}
                      {r.format_label && <span className="ml-1 text-muted">({r.format_label})</span>}
                    </td>
                    <td className={`px-3 py-2.5 ${statusTone(r.status)}`}>{STATUS_LABEL[r.status]}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={r.payment_status === "pending" && r.status !== "cancelled" ? "text-amber-400" : "text-muted"}>
                        {PAYMENT_LABEL[r.payment_status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{r.amount_krw != null ? formatKrw(r.amount_krw) : "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {formatDateFull(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/sessions/${r.session_id}`} className="text-xs text-glow underline">
                        회차 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {page > 1 && (
              <PageLink sp={sp} page={page - 1} label="← 이전" />
            )}
            {page < totalPages && (
              <PageLink sp={sp} page={page + 1} label="다음 →" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PageLink({
  sp,
  page,
  label,
}: {
  sp: Record<string, string | string[] | undefined>;
  page: number;
  label: string;
}) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v && k !== "page") next.set(k, v);
  }
  next.set("page", String(page));
  return (
    <Link href={`/applications?${next.toString()}`} className="rounded border border-border px-3 py-1.5 text-sm">
      {label}
    </Link>
  );
}
