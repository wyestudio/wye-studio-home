import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Chevron } from "@/components/ui/Chevron";
import { withBack } from "@/lib/adminBack";
import { STAGE_LABEL, STAGE_TAG, ago, pageLabel, visitorTag } from "./visitLabels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type Row = {
  visitor_id: string;
  first_at: string;
  last_at: string;
  visits: number;
  pages: number;
  clicks: number;
  first_path: string | null;
  first_source: string;
  last_path: string | null;
  stage: number;
  group_stage: number;
  applied: boolean;
  customer_name: string | null;
  phone_hash: string | null;
  group_inquiry_id: string | null;
  internal: boolean;
  total_count: number;
};

const DAYS = [
  { key: "1", label: "오늘" },
  { key: "7", label: "7일" },
  { key: "30", label: "30일" },
  { key: "90", label: "90일" },
];

/** 구분 — admin_visitor_list 의 p_filter */
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "picked", label: "회차까지 보고 나감" },
  { key: "dropped", label: "신청하다 나감" },
  { key: "applied", label: "신청함" },
  { key: "group", label: "단체 견적" },
];

const tag = "rounded-md px-2 py-0.5 text-micro font-semibold";

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다(대시보드와 같은 방식). */
function getNowMs(): number {
  return Date.now();
}

/**
 * 방문 발자취 — 브라우저 하나당 한 줄(2026-11-04 대표님, 공약분처럼 "누가 어디까지 왔나").
 *
 * 회원이 없어 신청 전에는 번호(방문자 #ab12)로만 보인다. 신청하면 그 사람 이름이 붙는다.
 * 줄을 누르면 그 브라우저가 지나간 길 전부(/visitors/[id]).
 * 기록은 src/lib/visitTrack.ts 가 쌓고, 90일이 지나면 지워진다.
 */
export default async function AdminVisitorsPage({ searchParams }: PageProps<"/admin/visitors">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const days = DAYS.some((d) => d.key === one("days")) ? one("days") : "7";
  const filter = FILTERS.some((f) => f.key === one("f")) ? one("f") : "all";
  const page = Math.max(1, Number(one("page")) || 1);

  const nowMs = getNowMs();
  // 오늘 = 한국 시간 0시부터
  const since =
    days === "1"
      ? new Date(`${new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10)}T00:00:00+09:00`)
      : new Date(nowMs - Number(days) * 86400_000);

  const supabase = createAdminClient();
  const list = (f: string, limit: number, offset: number) =>
    supabase.rpc("admin_visitor_list", { p_since: since.toISOString(), p_filter: f, p_limit: limit, p_offset: offset });

  // 구분별 사람 수(탭 옆 숫자)와 지금 목록
  const [rowsRes, ...countRes] = await Promise.all([
    list(filter, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ...FILTERS.map((f) => list(f.key, 1, 0)),
  ]);
  const { data: themes } = await supabase.from("themes").select("slug, name, variant_label");
  const themeNames = new Map(
    ((themes ?? []) as { slug: string; name: string; variant_label: string | null }[]).map((t) => [
      t.slug,
      [t.name, t.variant_label].filter(Boolean).join(" "),
    ]),
  );

  if (rowsRes.error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/visitors" />
          <div className="text-red-400">방문 발자취를 불러올 수 없습니다: {rowsRes.error.message}</div>
        </div>
      </div>
    );
  }

  const rows = (rowsRes.data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = new Map(
    FILTERS.map((f, i) => [f.key, ((countRes[i]?.data ?? []) as Row[])[0]?.total_count ?? 0] as const),
  );

  const href = (next: { days?: string; f?: string; page?: number }) => {
    const q = new URLSearchParams();
    const d = next.days ?? days;
    const f = next.f ?? filter;
    if (d !== "7") q.set("days", d);
    if (f !== "all") q.set("f", f);
    if ((next.page ?? 1) > 1) q.set("page", String(next.page));
    const s = q.toString();
    return s ? `/visitors?${s}` : "/visitors";
  };
  const here = href({ page });
  const who = (r: Row) => r.customer_name ?? visitorTag(r.visitor_id);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/visitors" />

        <header className="mb-5">
          <h1 className="text-h2 font-semibold">방문 발자취</h1>
          <p className="mt-1 text-body-sm text-muted">
            브라우저 하나를 한 사람으로 봅니다. 신청하기 전에는 번호로, 신청하면 이름으로 보입니다. 기록은 90일 보관합니다.
          </p>
        </header>

        {/* 기간 */}
        <div className="mb-3 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <Link
              key={d.key}
              href={href({ days: d.key })}
              className={`rounded-lg border px-3 py-1.5 text-body-sm ${
                d.key === days ? "border-glow bg-fill font-semibold text-foreground" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {d.label}
            </Link>
          ))}
        </div>

        {/* 구분 — 몇 명인지 같이 */}
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href({ f: f.key })}
              className={`shrink-0 rounded-lg border px-3 py-2 text-body-sm ${
                f.key === filter ? "border-glow bg-fill font-semibold text-foreground" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {f.label} <span className="tabular-nums">{counts.get(f.key) ?? 0}</span>
            </Link>
          ))}
        </div>

        <p className="mb-3 text-body-sm text-muted">
          총 <strong className="text-foreground">{total}</strong>명
          {totalPages > 1 && ` · ${page} / ${totalPages} 쪽`}
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border py-16 text-center text-body-sm text-muted">
            이 기간에 남은 발자취가 없습니다.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.visitor_id}>
                <Link
                  href={withBack(`/visitors/${r.visitor_id}`, here)}
                  className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-fill-subtle"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-body font-semibold ${r.customer_name ? "" : "text-muted"}`}>{who(r)}</span>
                      <span className={`${tag} ${STAGE_TAG[r.stage] ?? STAGE_TAG[0]}`}>
                        {r.applied && r.stage < 6 ? "신청함" : STAGE_LABEL[r.stage] ?? "둘러봄"}
                      </span>
                      {r.group_stage > 0 && (
                        <span className={`${tag} bg-fill text-foreground`}>
                          {r.group_inquiry_id || r.group_stage === 2 ? "단체 견적 접수" : "단체 견적 쓰다 멈춤"}
                        </span>
                      )}
                      {r.internal && (
                        <span className={`${tag} border border-amber-400/60 text-amber-400`}>우리 기기</span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-body-sm text-muted">
                      {r.first_source} → {pageLabel(r.first_path ?? "-", themeNames)}
                      {r.last_path && r.last_path !== r.first_path && ` … ${pageLabel(r.last_path, themeNames)}`}
                    </div>
                    <div className="mt-0.5 text-body-sm tabular-nums text-muted">
                      방문 {r.visits}번 · 화면 {r.pages} · 클릭 {r.clicks} · {ago(r.last_at, nowMs)}
                    </div>
                  </div>
                  <Chevron className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="rounded-lg border border-border px-4 py-2 text-body-sm">
                이전
              </Link>
            )}
            {page < totalPages && (
              <Link href={href({ page: page + 1 })} className="rounded-lg border border-border px-4 py-2 text-body-sm">
                다음
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
