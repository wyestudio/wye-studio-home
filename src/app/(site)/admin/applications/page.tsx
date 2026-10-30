import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Chevron } from "@/components/ui/Chevron";
import { formatKrw, formatDateTimeFull, formatDateFull } from "@/lib/format";
import { getInternalApplicationIds } from "@/lib/internalTraffic";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  id: string;
  confirmation_code: string;
  status: "confirmed" | "waiting" | "cancelled";
  payment_status: "pending" | "confirmed" | "cancelled";
  headcount: number;
  amount_krw: number | null;
  discount_krw: number | null;
  /** 이 신청에 붙은 쿠폰들 '캠페인명 코드, …'. 없으면 null */
  coupons: string | null;
  created_at: string;
  session_id: string;
  session_start_at: string;
  theme_name: string | null;
  theme_mode: string | null;
  format_label: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  depositor_name: string | null;
  total_count: number;
};

const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "확정", cls: "bg-glow text-black" },
  waiting: { label: "대기", cls: "bg-amber-400 text-black" },
  cancelled: { label: "취소", cls: "bg-zinc-500 text-white" },
};
const PAYMENT_TAG: Record<string, { label: string; cls: string }> = {
  pending: { label: "입금 전", cls: "bg-amber-400 text-black" },
  confirmed: { label: "입금 확인", cls: "bg-green-500 text-black" },
  cancelled: { label: "취소", cls: "bg-fill-strong text-muted" },
};

const SORTS = [
  { value: "created_desc", label: "신청 최신순" },
  { value: "created_asc", label: "신청 오래된순" },
  { value: "session_asc", label: "회차 날짜 빠른순" },
  { value: "session_desc", label: "회차 날짜 늦은순" },
  { value: "name_asc", label: "이름순" },
];

/** 검색 칸 — 주소(?name=&phone=…)에 담긴다. 새로고침 · 뒤로가기 · 링크 공유가 그대로 된다. */
const FIELDS = ["q", "name", "phone", "theme", "status", "payment", "from", "to", "time", "sort", "session"] as const;

/** 전화번호 뒤 4자리만 노출한다. 목록에서 전체 번호를 흘릴 이유가 없다. */
function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `···${d.slice(-4)}` : "-";
}

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-input";
const tag = "rounded-md px-2 py-0.5 text-micro font-semibold";

/**
 * 신청 목록 — 모든 회차의 신청을 한 곳에서 찾는다.
 *
 * 조건을 넣고 「검색」 을 눌러야 조회한다(2026-10-30 대표님). 칸을 바꿀 때마다 바로 조회하면
 * 여러 조건을 넣는 동안 화면이 계속 바뀐다. 그래서 그냥 GET 폼이다 — 클라이언트 코드가 없다.
 * 검색은 DB 의 admin_search_applications_v2(이름 · 전화는 참여자 누구든, 회차 날짜 · 시각, 정렬).
 */
export default async function AdminApplicationsPage({ searchParams }: PageProps<"/admin/applications">) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const v = Object.fromEntries(FIELDS.map((k) => [k, get(k) ?? ""])) as Record<(typeof FIELDS)[number], string>;
  const sort = SORTS.some((s) => s.value === v.sort) ? v.sort : "created_desc";
  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  const ymd = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

  const supabase = createAdminClient();

  const [rowsRes, themesRes, sessionRes] = await Promise.all([
    supabase.rpc("admin_search_applications_v2", {
      p_query: v.q || null,
      p_name: v.name || null,
      p_phone: v.phone || null,
      p_session_id: v.session || null,
      p_theme_id: v.theme || null,
      p_status: v.status || null,
      p_payment: v.payment || null,
      p_date_from: ymd(v.from),
      p_date_to: ymd(v.to),
      p_time: /^\d{2}:\d{2}$/.test(v.time) ? v.time : null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.from("themes").select("id, name, variant_label").order("sort_order").order("created_at"),
    // 회차 상세 · 대시보드에서 '이 회차만' 으로 들어왔을 때 무슨 회차인지 보여 준다.
    v.session
      ? supabase.from("session_display").select("start_at, theme_name, theme_mode").eq("id", v.session).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (rowsRes.error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/applications" />
          <div className="text-red-400">신청 목록을 불러올 수 없습니다: {rowsRes.error.message}</div>
        </div>
      </div>
    );
  }

  const rows = (rowsRes.data ?? []) as Row[];
  // 우리 기기에서 넣은 신청. 분석에서는 빠지지만 여기서는 그대로 보이니 배지로 구분한다.
  const internalIds = await getInternalApplicationIds(rows.map((r) => r.id));
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const themes = (themesRes.data ?? []) as { id: string; name: string; variant_label: string | null }[];
  const onlySession = sessionRes.data as { start_at: string; theme_name: string | null; theme_mode: string | null } | null;
  const applied = FIELDS.filter((k) => k !== "sort" && v[k]).length;

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    for (const k of FIELDS) if (v[k]) next.set(k, v[k]);
    if (n > 1) next.set("page", String(n));
    return `/applications?${next.toString()}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/applications" />

        <header className="mb-5">
          <h1 className="text-h2 font-semibold">신청 목록</h1>
        </header>

        {/* ── 검색 조건 ── 조건이 걸려 있으면 펼쳐 둔다 */}
        <details open={applied > 0 || undefined} className="group mb-5 rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
            검색 조건
            {applied > 0 && <span className={`${tag} bg-glow text-black`}>{applied}개 적용</span>}
            <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <form action="/applications" className="grid grid-cols-2 gap-3 border-t border-border p-4 md:grid-cols-4">
            {v.session && <input type="hidden" name="session" value={v.session} />}
            <Labeled label="이름 (참여자 · 입금자)">
              <input name="name" defaultValue={v.name} placeholder="예: 김하나" className={field} />
            </Labeled>
            <Labeled label="전화번호">
              <input name="phone" defaultValue={v.phone} inputMode="numeric" placeholder="뒤 4자리도 돼요" className={field} />
            </Labeled>
            <Labeled label="접수번호">
              <input name="q" defaultValue={v.q} inputMode="numeric" placeholder="6자리" className={field} />
            </Labeled>
            <Labeled label="테마 · 모드">
              <select name="theme" defaultValue={v.theme} className={field}>
                <option value="">전체</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.variant_label ? ` ${t.variant_label}` : ""}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="회차 날짜 (부터)">
              <input type="date" name="from" defaultValue={v.from} className={field} style={{ colorScheme: "dark" }} />
            </Labeled>
            <Labeled label="회차 날짜 (까지)">
              <input type="date" name="to" defaultValue={v.to} className={field} style={{ colorScheme: "dark" }} />
            </Labeled>
            <Labeled label="회차 시각">
              <input type="time" name="time" defaultValue={v.time} className={field} style={{ colorScheme: "dark" }} />
            </Labeled>
            <Labeled label="신청 상태">
              <select name="status" defaultValue={v.status} className={field}>
                <option value="">전체</option>
                <option value="confirmed">확정</option>
                <option value="waiting">대기</option>
                <option value="cancelled">취소</option>
              </select>
            </Labeled>
            <Labeled label="입금">
              <select name="payment" defaultValue={v.payment} className={field}>
                <option value="">전체</option>
                <option value="pending">입금 전</option>
                <option value="confirmed">입금 확인</option>
                <option value="cancelled">취소</option>
              </select>
            </Labeled>
            <Labeled label="정렬">
              <select name="sort" defaultValue={sort} className={field}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Labeled>
            <div className="col-span-2 flex items-end gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-glow px-4 py-2.5 text-body font-semibold text-black md:flex-none">
                검색
              </button>
              <Link href="/applications" className="rounded-lg border border-border px-4 py-2.5 text-body text-muted">
                초기화
              </Link>
            </div>
          </form>
        </details>

        {onlySession && (
          <p className="mb-3 text-body-sm">
            <span className={`${tag} bg-fill text-foreground`}>
              이 회차만: {formatDateTimeFull(onlySession.start_at)} {onlySession.theme_mode ?? onlySession.theme_name}
            </span>
          </p>
        )}

        <p className="mb-3 text-body-sm text-muted">
          총 <strong className="text-foreground">{total}</strong>건
          {totalPages > 1 && ` · ${page} / ${totalPages} 쪽`}
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border py-16 text-center text-body-sm text-muted">
            조건에 맞는 신청이 없습니다.
          </div>
        ) : (
          <>
            {/* 휴대폰: 카드 — 누르면 그 회차 상세로 */}
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/sessions/${r.session_id}`}
                    className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-fill-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-body font-semibold">{r.representative_name ?? "-"}</span>
                        <span className="text-body-sm text-muted">{r.headcount}명</span>
                        <span className={`${tag} ${STATUS_TAG[r.status].cls}`}>{STATUS_TAG[r.status].label}</span>
                        {r.status !== "cancelled" && (
                          <span className={`${tag} ${PAYMENT_TAG[r.payment_status].cls}`}>
                            {PAYMENT_TAG[r.payment_status].label}
                          </span>
                        )}
                        {internalIds.has(r.id) && <TestBadge />}
                      </div>
                      <div className="mt-1 text-body-sm tabular-nums text-muted">
                        {formatDateTimeFull(r.session_start_at)} {r.theme_mode ?? r.format_label ?? ""}
                      </div>
                      <div className="mt-0.5 text-body-sm tabular-nums text-muted">
                        {r.confirmation_code} · {maskPhone(r.representative_phone)}
                        {r.amount_krw != null && ` · ${formatKrw(r.amount_krw)}`}
                      </div>
                    </div>
                    <Chevron className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* 컴퓨터: 표 */}
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full text-body-sm">
                <thead className="border-b border-border text-left text-label text-muted">
                  <tr>
                    <th className="px-3 py-2.5">접수번호</th>
                    <th className="px-3 py-2.5">신청자</th>
                    <th className="px-3 py-2.5">인원</th>
                    <th className="px-3 py-2.5">회차</th>
                    <th className="px-3 py-2.5">상태</th>
                    <th className="px-3 py-2.5 text-right">금액</th>
                    <th className="px-3 py-2.5">신청일</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-fill-subtle">
                      <td className="px-3 py-3 font-mono">
                        {r.confirmation_code}
                        {internalIds.has(r.id) && <TestBadge />}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold">{r.representative_name ?? "-"}</span>
                        <span className="ml-1.5 text-muted tabular-nums">{maskPhone(r.representative_phone)}</span>
                        {r.depositor_name && r.depositor_name !== r.representative_name && (
                          <span className="block text-amber-400" title="입금자명이 신청자와 다릅니다">
                            입금자 {r.depositor_name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">{r.headcount}명</td>
                      <td className="px-3 py-3">
                        <Link href={`/sessions/${r.session_id}`} className="text-glow hover:underline">
                          {formatDateTimeFull(r.session_start_at)}
                        </Link>
                        {(r.theme_mode ?? r.format_label) && (
                          <span className="block text-muted">{r.theme_mode ?? r.format_label}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap gap-1">
                          <span className={`${tag} ${STATUS_TAG[r.status].cls}`}>{STATUS_TAG[r.status].label}</span>
                          {r.status !== "cancelled" && (
                            <span className={`${tag} ${PAYMENT_TAG[r.payment_status].cls}`}>
                              {PAYMENT_TAG[r.payment_status].label}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.amount_krw != null ? formatKrw(r.amount_krw) : "-"}
                        {/*
                          쿠폰 중복 적용이 되면서 같은 회차라도 결제액이 제각각이다.
                          왜 이 금액인지 목록에서 바로 알 수 있어야 한다.
                        */}
                        {r.discount_krw != null && r.discount_krw > 0 && (
                          <span className="block text-glow" title={r.coupons ?? undefined}>
                            쿠폰 −{formatKrw(r.discount_krw)}
                          </span>
                        )}
                        {r.coupons && <span className="block text-muted">{r.coupons}</span>}
                      </td>
                      <td className="px-3 py-3 text-muted">{formatDateFull(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="rounded-lg border border-border px-4 py-2 text-body-sm">
                이전
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="rounded-lg border border-border px-4 py-2 text-body-sm">
                다음
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-body-sm text-muted">
      {label}
      {children}
    </label>
  );
}

function TestBadge() {
  return (
    <span
      className="ml-1.5 rounded-md border border-amber-400/60 px-1 py-0.5 font-sans text-micro font-semibold text-amber-400"
      title="테스트 기기(/internal)에서 넣은 신청 — 분석에서 빠집니다"
    >
      테스트
    </span>
  );
}
