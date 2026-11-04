import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Chevron } from "@/components/ui/Chevron";
import { formatKrw, formatDateFull } from "@/lib/format";
import { withBack } from "@/lib/adminBack";
import { SortLink, nextSort, type SortDir } from "@/components/admin/SortLink";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  phone_hash: string;
  name: string | null;
  phone: string | null;
  nickname: string | null;
  /** 확정 · 회차가 지난 신청 수 */
  joined: number;
  /** 확정 · 대기 중 아직 안 한 회차 */
  upcoming: number;
  cancelled: number;
  themes: string | null;
  /** 이 사람이 대표로 낸 입금 확인 금액 합 */
  paid_krw: number;
  first_at: string | null;
  last_at: string | null;
  first_source: string | null;
  internal: boolean;
  total_count: number;
};

type Cohort = { cohort: string; people: number; returned: number; returned_90d: number };

/** 표 머리를 눌러 정렬하는 칸과 처음 누를 때의 방향. */
const SORT_KEYS: Record<string, { label: string; dir: SortDir }> = {
  name: { label: "이름", dir: "asc" },
  joined: { label: "참여", dir: "desc" },
  paid: { label: "결제", dir: "desc" },
  first: { label: "첫 참여", dir: "asc" },
  last: { label: "마지막", dir: "desc" },
};

const FIELDS = ["q", "theme", "repeat", "sort", "dir"] as const;

function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `···${d.slice(-4)}` : "-";
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "-");

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-input";
const tag = "rounded-md px-2 py-0.5 text-micro font-semibold";

/**
 * 고객 — 같은 전화번호를 한 사람으로 묶어 한 줄씩(2026-11-04 대표님, 공약분 '학습 현황' 처럼).
 *
 * 회원이 없으니 신청할 때 받은 참여자 전화번호가 사람을 가른다. 대표자 · 동행자를 똑같이 센다.
 * 줄을 누르면 그 사람의 신청 기록 전부(/customers/[hash])로 간다.
 * 데이터는 DB 의 admin_customer_list · admin_customer_retention(서비스 키 전용).
 */
export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const v = Object.fromEntries(FIELDS.map((k) => [k, get(k) ?? ""])) as Record<(typeof FIELDS)[number], string>;
  const sortKey = v.sort in SORT_KEYS ? v.sort : "last";
  const sortDir: SortDir = v.dir === "asc" || v.dir === "desc" ? v.dir : SORT_KEYS[sortKey].dir;
  const page = Math.max(1, Number(get("page") ?? 1) || 1);

  const supabase = createAdminClient();
  const [rowsRes, themesRes, retentionRes] = await Promise.all([
    supabase.rpc("admin_customer_list", {
      p_query: v.q || null,
      p_theme_id: v.theme || null,
      p_repeat_only: v.repeat === "1",
      p_sort: `${sortKey}_${sortDir}`,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.from("themes").select("id, name, variant_label").order("sort_order").order("created_at"),
    supabase.rpc("admin_customer_retention"),
  ]);

  if (rowsRes.error || retentionRes.error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/customers" />
          <div className="text-red-400">
            고객 목록을 불러올 수 없습니다: {(rowsRes.error ?? retentionRes.error)?.message}
          </div>
        </div>
      </div>
    );
  }

  const rows = (rowsRes.data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const themes = (themesRes.data ?? []) as { id: string; name: string; variant_label: string | null }[];
  const cohorts = (retentionRes.data ?? []) as Cohort[];
  const people = cohorts.reduce((s, c) => s + c.people, 0);
  const returned = cohorts.reduce((s, c) => s + c.returned, 0);
  const applied = FIELDS.filter((k) => k !== "sort" && k !== "dir" && v[k]).length;

  const pageHref = (n: number, sort?: { key: string; dir: SortDir }) => {
    const next = new URLSearchParams();
    for (const k of FIELDS) if (v[k] && k !== "sort" && k !== "dir") next.set(k, v[k]);
    const srt = sort ?? { key: sortKey, dir: sortDir };
    if (srt.key !== "last" || srt.dir !== "desc") {
      next.set("sort", srt.key);
      next.set("dir", srt.dir);
    }
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/customers?${qs}` : "/customers";
  };
  const sortProps = (key: string) => ({
    label: SORT_KEYS[key].label,
    active: sortKey === key,
    dir: sortDir,
    href: pageHref(1, nextSort({ key: sortKey, dir: sortDir }, key, SORT_KEYS[key].dir)),
  });
  const detailHref = (r: Row) => withBack(`/customers/${encodeURIComponent(r.phone_hash)}`, pageHref(page));

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/customers" />

        <header className="mb-5">
          <h1 className="text-h2 font-semibold">고객</h1>
          <p className="mt-1 text-body-sm text-muted">같은 전화번호를 한 사람으로 묶었습니다. 대표자 · 동행자를 똑같이 셉니다.</p>
        </header>

        {/* ── 한눈에 ── 우리 기기에서 넣은 신청은 리텐션에서 뺐다 */}
        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="참여한 사람" value={`${people}명`} sub="확정 · 회차가 지난 기준" />
          <Stat label="다시 온 사람" value={`${returned}명`} sub={`참여한 사람의 ${pct(returned, people)}`} />
          <Stat
            label="90일 안에 다시 옴"
            value={`${cohorts.reduce((s, c) => s + c.returned_90d, 0)}명`}
            sub={`참여한 사람의 ${pct(cohorts.reduce((s, c) => s + c.returned_90d, 0), people)}`}
          />
          <Stat label="이 조건의 고객" value={`${total}명`} sub={applied > 0 ? "검색 조건 적용" : "취소만 한 사람 포함"} />
        </section>

        {/* ── 리텐션 ── 첫 참여 달별 */}
        {cohorts.length > 0 && (
          <details className="group mb-5 rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
              첫 참여 달별 재참여
              <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-body-sm">
                <thead className="border-b border-border text-left text-label text-muted">
                  <tr>
                    <th className="px-4 py-2.5">첫 참여</th>
                    <th className="px-4 py-2.5 text-right">사람</th>
                    <th className="px-4 py-2.5 text-right">다시 옴</th>
                    <th className="px-4 py-2.5 text-right">90일 안에</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.cohort} className="border-b border-border/50 last:border-0 tabular-nums">
                      <td className="px-4 py-2.5">{c.cohort}</td>
                      <td className="px-4 py-2.5 text-right">{c.people}</td>
                      <td className="px-4 py-2.5 text-right">
                        {c.returned} <span className="text-muted">({pct(c.returned, c.people)})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.returned_90d} <span className="text-muted">({pct(c.returned_90d, c.people)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-4 py-2.5 text-body-sm text-muted">
                다음 신청이 아직 안 한 회차여도 다시 온 것으로 셉니다. 최근 달은 아직 시간이 덜 지나 낮게 나옵니다.
              </p>
            </div>
          </details>
        )}

        {/* ── 검색 조건 ── */}
        <details open={applied > 0 || undefined} className="group mb-5 rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
            검색 조건
            {applied > 0 && <span className={`${tag} bg-glow text-black`}>{applied}개 적용</span>}
            <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <form action="/customers" className="grid grid-cols-2 gap-3 border-t border-border p-4 md:grid-cols-4">
            <Labeled label="이름 · 닉네임 · 전화번호">
              <input name="q" defaultValue={v.q} placeholder="예: 김하나, 뒤 4자리" className={field} />
            </Labeled>
            <Labeled label="다녀간 테마 · 모드">
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
            <Labeled label="재참여">
              <select name="repeat" defaultValue={v.repeat} className={field}>
                <option value="">전체</option>
                <option value="1">2번 이상 (예정 포함)</option>
              </select>
            </Labeled>
            {v.sort && <input type="hidden" name="sort" value={v.sort} />}
            {v.dir && <input type="hidden" name="dir" value={v.dir} />}
            <div className="col-span-2 flex justify-end gap-2 border-t border-border pt-4 md:col-span-4">
              <Link
                href="/customers"
                className="rounded-lg border border-border px-5 py-2.5 text-body-sm font-semibold text-muted hover:text-foreground"
              >
                초기화
              </Link>
              <button type="submit" className="min-w-28 rounded-lg bg-glow px-6 py-2.5 text-body-sm font-semibold text-black">
                검색
              </button>
            </div>
          </form>
        </details>

        <p className="mb-3 text-body-sm text-muted">
          총 <strong className="text-foreground">{total}</strong>명
          {totalPages > 1 && ` · ${page} / ${totalPages} 쪽`}
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border py-16 text-center text-body-sm text-muted">
            조건에 맞는 고객이 없습니다.
          </div>
        ) : (
          <>
            {/* 휴대폰: 정렬 칸 한 줄 + 카드 */}
            <div className="-mx-4 mb-2 flex gap-3 overflow-x-auto px-4 text-body-sm text-muted [scrollbar-width:none] md:hidden">
              {Object.keys(SORT_KEYS).map((k) => (
                <SortLink key={k} {...sortProps(k)} />
              ))}
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((r) => (
                <li key={r.phone_hash}>
                  <Link
                    href={detailHref(r)}
                    className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-fill-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-body font-semibold">{r.name ?? "-"}</span>
                        {r.nickname && <span className="text-body-sm text-muted">{r.nickname}</span>}
                        <Visits r={r} />
                        {r.internal && <TestBadge />}
                      </div>
                      <div className="mt-1 truncate text-body-sm text-muted">{r.themes ?? "취소만 함"}</div>
                      <div className="mt-0.5 text-body-sm tabular-nums text-muted">
                        {maskPhone(r.phone)}
                        {r.last_at && ` · 마지막 ${formatDateFull(r.last_at)}`}
                        {r.paid_krw > 0 && ` · ${formatKrw(r.paid_krw)}`}
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
                    <th className="px-3 py-2.5"><SortLink {...sortProps("name")} /></th>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("joined")} /></th>
                    <th className="px-3 py-2.5">다녀간 테마</th>
                    <th className="px-3 py-2.5 text-right"><SortLink {...sortProps("paid")} /></th>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("first")} /></th>
                    <th className="px-3 py-2.5"><SortLink {...sortProps("last")} /></th>
                    <th className="px-3 py-2.5">처음 유입</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.phone_hash} className="border-b border-border/50 last:border-0 hover:bg-fill-subtle">
                      <td className="px-3 py-3">
                        <Link href={detailHref(r)} className="font-semibold text-glow hover:underline">
                          {r.name ?? "-"}
                        </Link>
                        {r.internal && <TestBadge />}
                        <span className="block text-muted tabular-nums">
                          {maskPhone(r.phone)}
                          {r.nickname && ` · ${r.nickname}`}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Visits r={r} />
                      </td>
                      <td className="px-3 py-3 text-muted">{r.themes ?? "취소만 함"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.paid_krw > 0 ? formatKrw(r.paid_krw) : <span className="text-muted">0</span>}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted">{r.first_at ? formatDateFull(r.first_at) : "-"}</td>
                      <td className="px-3 py-3 tabular-nums text-muted">{r.last_at ? formatDateFull(r.last_at) : "-"}</td>
                      <td className="px-3 py-3 text-muted">{r.first_source ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-body-sm text-muted">결제는 그 사람이 대표로 신청해 입금이 확인된 금액입니다. 동행자는 0으로 보입니다.</p>
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

/** 참여 · 예정 · 취소 — 2번 이상 온 사람은 눈에 띄게. */
function Visits({ r }: { r: Row }) {
  const times = r.joined + r.upcoming;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`${tag} ${times >= 2 ? "bg-glow text-black" : "bg-fill-strong text-foreground"}`}>
        {r.joined}번 참여
      </span>
      {r.upcoming > 0 && <span className={`${tag} bg-amber-400 text-black`}>예정 {r.upcoming}</span>}
      {r.cancelled > 0 && <span className={`${tag} bg-zinc-500 text-white`}>취소 {r.cancelled}</span>}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 text-h3 font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-body-sm text-muted">{sub}</p>
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
      className="ml-1.5 rounded-md border border-amber-400/60 px-1 py-0.5 text-micro font-semibold text-amber-400"
      title="테스트 기기(/internal)에서 넣은 신청이 있습니다 — 리텐션에서 빠집니다"
    >
      테스트
    </span>
  );
}
