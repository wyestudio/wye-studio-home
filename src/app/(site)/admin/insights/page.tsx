import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Chevron } from "@/components/ui/Chevron";
import { withBack } from "@/lib/adminBack";
import { CLARITY_URL, STAGE_LABEL, STAGE_TAG, ago, pageLabel, visitorTag } from "../visitors/visitLabels";

export const dynamic = "force-dynamic";

type Overview = {
  visitors: number;
  visits: number;
  pageviews: number;
  new_visitors: number;
  mobile: number;
  applied_db: number;
  funnel: Record<string, number>;
  pages: { name: string; visitors: number; views: number }[];
  clicks: { name: string; path: string | null; visitors: number; clicks: number }[];
  sources: { src: string; visitors: number }[];
  hours: Record<string, number>;
  days: Record<string, number>;
  since_first: string | null;
};

type Recent = {
  visitor_id: string;
  last_at: string;
  first_source: string;
  last_path: string | null;
  stage: number;
  applied: boolean;
  customer_name: string | null;
  internal: boolean;
};

const PERIODS = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "7", label: "7일" },
  { key: "30", label: "30일" },
] as const;

/** 예약 신청 단계 — admin_visit_overview 의 funnel 키 */
const FUNNEL: { key: string; label: string; hint?: string }[] = [
  { key: "theme", label: "테마 상세를 봄" },
  { key: "pick", label: "회차를 고름" },
  { key: "apply_click", label: "신청하기를 누름" },
  { key: "start", label: "신청서를 엶" },
  { key: "consent", label: "약관 단계까지" },
  { key: "submit_step", label: "제출 단계까지" },
  { key: "done", label: "신청 완료" },
];

const GROUP_FUNNEL: { key: string; label: string }[] = [
  { key: "group_page", label: "단체 예약 페이지를 봄" },
  { key: "group_start", label: "견적서를 쓰기 시작" },
  { key: "group_submit", label: "견적 접수" },
];

const DAY_MS = 86400_000;
const KST_MS = 9 * 3600_000;

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다(대시보드와 같은 방식). */
function getNowMs(): number {
  return Date.now();
}

/** 한국 시간 그날 0시(UTC ms) */
function kstMidnight(ms: number): number {
  const d = new Date(ms + KST_MS).toISOString().slice(0, 10);
  return Date.parse(`${d}T00:00:00+09:00`);
}

/** 기간 → [시작, 끝) 과 비교할 바로 앞 같은 길이 기간 */
function windowOf(period: string, nowMs: number) {
  const today = kstMidnight(nowMs);
  if (period === "yesterday") return { from: today - DAY_MS, to: today, prevFrom: today - 2 * DAY_MS, compare: "그 전날" };
  if (period === "7" || period === "30") {
    const len = Number(period) * DAY_MS;
    return { from: nowMs - len, to: nowMs, prevFrom: nowMs - 2 * len, compare: `그 전 ${period}일` };
  }
  // 오늘: 0시부터 지금까지 — 어제 같은 시각까지와 비교한다
  return { from: today, to: nowMs, prevFrom: today - DAY_MS, prevTo: nowMs - DAY_MS, compare: "어제 이 시각까지" };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/**
 * 방문 분석 — "오늘 몇 명이 와서 무엇을 봤고, 무엇을 몇 명이 눌렀나" 를 한 화면에(2026-11-04 대표님).
 *
 * 공약분 어드민처럼 한눈에 들어오게: 위에서부터 숫자 → 어디까지 왔나 → 어디서 왔나 · 무엇을 봤나
 * → 무엇을 눌렀나 → 시간대 → 최근 방문자. 칸마다 더 자세한 화면으로 가는 링크를 단다.
 * 숫자는 우리가 직접 쌓는 방문 기록(visitTrack.ts → admin_visit_overview)이다. 우리 기기는 뺀다.
 */
export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.key === sp.p) ? (sp.p as string) : "today";
  const nowMs = getNowMs();
  const w = windowOf(period, nowMs);
  const iso = (ms: number) => new Date(ms).toISOString();

  const supabase = createAdminClient();
  const [curRes, prevRes, recentRes, themesRes] = await Promise.all([
    supabase.rpc("admin_visit_overview", { p_since: iso(w.from), p_until: iso(w.to) }),
    supabase.rpc("admin_visit_overview", { p_since: iso(w.prevFrom), p_until: iso(w.prevTo ?? w.from) }),
    supabase.rpc("admin_visitor_list", { p_since: iso(w.from), p_filter: "all", p_limit: 20, p_offset: 0 }),
    supabase.from("themes").select("slug, name, variant_label"),
  ]);

  if (curRes.error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/insights" />
          <div className="text-red-400">방문 분석을 불러올 수 없습니다: {curRes.error.message}</div>
        </div>
      </div>
    );
  }

  const o = curRes.data as Overview;
  const prev = (prevRes.data ?? null) as Overview | null;
  const recent = ((recentRes.data ?? []) as Recent[]).filter((r) => !r.internal).slice(0, 6);
  const themeNames = new Map(
    ((themesRes.data ?? []) as { slug: string; name: string; variant_label: string | null }[]).map((t) => [
      t.slug,
      [t.name, t.variant_label].filter(Boolean).join(" "),
    ]),
  );
  const multiDay = period === "7" || period === "30";
  const tab = (key: string) => (key === "today" ? "/insights" : `/insights?p=${key}`);
  const here = tab(period);
  const delta = (cur: number, before: number | undefined) => {
    if (before == null) return null;
    const d = cur - before;
    return d === 0 ? "변화 없음" : `${d > 0 ? "+" : ""}${d}`;
  };

  // 시간대 · 날짜 막대
  const bars = multiDay
    ? Array.from({ length: Number(period) }, (_, i) => {
        const d = new Date(kstMidnight(nowMs) - (Number(period) - 1 - i) * DAY_MS + KST_MS).toISOString().slice(0, 10);
        return { label: d.slice(5).replace("-", "/"), n: o.days[d] ?? 0 };
      })
    : Array.from({ length: 24 }, (_, h) => ({ label: `${h}`, n: o.hours[String(h)] ?? 0 }));
  const barMax = Math.max(1, ...bars.map((b) => b.n));
  const funnelBase = Math.max(o.visitors, 1);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/insights" />

        <header className="mb-4">
          <h1 className="text-h2 font-semibold">방문 분석</h1>
          <p className="mt-1 text-body-sm text-muted">
            누가 몇 명 와서 무엇을 보고 무엇을 눌렀는지 한 화면에 모았습니다. 우리 기기는 빼고 셉니다.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={tab(p.key)}
              className={`rounded-lg border px-4 py-2 text-body-sm ${
                p.key === period ? "border-glow bg-fill font-semibold text-foreground" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        {/* ── 숫자 넷 ── */}
        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="방문자" value={`${o.visitors}명`} sub={`${w.compare} ${delta(o.visitors, prev?.visitors) ?? "-"}`} />
          <Stat label="처음 온 사람" value={`${o.new_visitors}명`} sub={`방문자의 ${pct(o.new_visitors, o.visitors)}%`} />
          <Stat label="휴대폰으로 봄" value={`${pct(o.mobile, o.visitors)}%`} sub={`${o.mobile}명 · 화면 ${o.pageviews}번 열림`} />
          <Stat
            label="신청 완료"
            value={`${o.funnel.done ?? 0}명`}
            sub={`실제 신청 ${o.applied_db}건 (DB 기준)`}
            warn={o.applied_db !== (o.funnel.done ?? 0)}
          />
        </section>

        {/* ── 어디까지 왔나 ── */}
        <section className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card title="어디까지 왔나" sub={`방문자 ${o.visitors}명 중 각 단계까지 간 사람`} more={{ href: "/visitors", label: "사람별로 보기" }}>
            <ol className="flex flex-col gap-2.5">
              {FUNNEL.map((f) => {
                const n = o.funnel[f.key] ?? 0;
                return (
                  <li key={f.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
                      <span>{f.label}</span>
                      <span className="tabular-nums">
                        <strong className="text-foreground">{n}명</strong>
                        <span className="ml-1.5 text-muted">{pct(n, funnelBase)}%</span>
                      </span>
                    </div>
                    <Bar ratio={n / funnelBase} />
                  </li>
                );
              })}
            </ol>
            {(o.funnel.sold_out ?? 0) > 0 && (
              <p className="mt-3 text-body-sm text-amber-400">마감된 회차를 눌러 본 사람 {o.funnel.sold_out}명 — 원하는 날짜가 없었다는 뜻일 수 있습니다.</p>
            )}
          </Card>
          <Card title="단체 예약" sub="단체 페이지에서 견적 접수까지" more={{ href: "/visitors?f=group", label: "사람별로 보기" }}>
            <ol className="flex flex-col gap-2.5">
              {GROUP_FUNNEL.map((f) => {
                const n = o.funnel[f.key] ?? 0;
                return (
                  <li key={f.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
                      <span>{f.label}</span>
                      <strong className="tabular-nums">{n}명</strong>
                    </div>
                    <Bar ratio={n / funnelBase} />
                  </li>
                );
              })}
            </ol>
          </Card>
        </section>

        {/* ── 어디서 왔나 · 무엇을 봤나 ── */}
        <section className="mb-5 grid gap-3 md:grid-cols-2">
          <Card title="어디서 왔나" sub="처음 들어온 곳 · utm 이 있으면 그 이름" more={{ href: "/utm", label: "유입경로 링크 만들기" }}>
            <Ranked rows={o.sources.map((s) => ({ key: s.src, label: s.src, n: s.visitors }))} unit="명" empty="아직 기록이 없습니다." />
          </Card>
          <Card title="많이 본 화면" sub="본 사람 수 · 열린 횟수">
            <Ranked
              rows={o.pages.map((p) => ({ key: p.name, label: pageLabel(p.name, themeNames), n: p.visitors, extra: `${p.views}번` }))}
              unit="명"
              empty="아직 기록이 없습니다."
            />
          </Card>
        </section>

        {/* ── 무엇을 눌렀나 ── */}
        <section className="mb-5">
          <Card title="많이 누른 버튼 · 링크" sub="누른 사람 수 · 누른 횟수. 신청서처럼 가려진 화면의 버튼은 정해 둔 이름으로만 보입니다.">
            {o.clicks.length === 0 ? (
              <p className="text-body-sm text-muted">아직 기록이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead className="border-b border-border text-left text-label text-muted">
                    <tr>
                      <th className="py-2 pr-3">버튼</th>
                      <th className="py-2 pr-3">어느 화면에서</th>
                      <th className="py-2 pr-3 text-right">누른 사람</th>
                      <th className="py-2 text-right">횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.clicks.map((c, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-3 font-semibold">{c.name}</td>
                        <td className="py-2 pr-3 text-muted">{c.path ? pageLabel(c.path, themeNames) : "-"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{c.visitors}명</td>
                        <td className="py-2 text-right tabular-nums text-muted">{c.clicks}번</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* ── 언제 왔나 · 최근 방문자 ── */}
        <section className="mb-5 grid gap-3 lg:grid-cols-2">
          <Card title={multiDay ? "날짜별 방문자" : "시간대별 방문자"} sub={multiDay ? "하루 방문자 수" : "한국 시간, 그 시간에 다녀간 사람 수"}>
            <div className="flex h-36 items-end gap-0.5">
              {bars.map((b) => (
                <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label} · ${b.n}명`}>
                  <div className="bg-glow" style={{ height: `${(b.n / barMax) * 100}%`, minHeight: b.n ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-micro text-muted tabular-nums">
              <span>{bars[0]?.label}{multiDay ? "" : "시"}</span>
              <span>{bars[Math.floor(bars.length / 2)]?.label}{multiDay ? "" : "시"}</span>
              <span>{bars.at(-1)?.label}{multiDay ? "" : "시"}</span>
            </div>
          </Card>
          <Card title="최근 방문자" sub="누르면 그 사람이 지나간 길" more={{ href: "/visitors", label: "전체 보기" }}>
            {recent.length === 0 ? (
              <p className="text-body-sm text-muted">아직 기록이 없습니다.</p>
            ) : (
              <ul className="flex flex-col">
                {recent.map((r) => (
                  <li key={r.visitor_id} className="border-b border-border/40 last:border-0">
                    <Link
                      href={withBack(`/visitors/${r.visitor_id}`, here)}
                      className="flex items-center gap-2 py-2 text-body-sm hover:bg-fill-subtle"
                    >
                      <span className={`min-w-0 flex-1 truncate ${r.customer_name ? "font-semibold" : "text-muted"}`}>
                        {r.customer_name ?? visitorTag(r.visitor_id)}
                        <span className="ml-1.5 font-normal text-muted">
                          {r.first_source} · {pageLabel(r.last_path ?? "-", themeNames)}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-micro font-semibold ${STAGE_TAG[r.stage] ?? STAGE_TAG[0]}`}>
                        {r.applied && r.stage < 6 ? "신청함" : STAGE_LABEL[r.stage] ?? "둘러봄"}
                      </span>
                      <span className="w-14 shrink-0 text-right text-muted tabular-nums">{ago(r.last_at, nowMs)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* ── 다른 화면으로 ── 무엇이 어디 있는지 */}
        <section className="mb-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Guide href="/visitors" title="방문 발자취" desc="한 사람씩 — 어디서 들어와 무엇을 보고 어디서 나갔나" />
          <Guide href="/customers" title="고객" desc="신청한 사람 — 몇 번 왔나, 얼마 냈나, 다시 왔나" />
          <Guide href="/analytics" title="GA4 상세 분석" desc="구글 애널리틱스 숫자 — 긴 기간 추이와 광고 캠페인" />
          {CLARITY_URL ? (
            <Guide href={CLARITY_URL} title="Clarity 녹화 ↗" desc="화면을 어떻게 움직였는지 영상으로 · 많이 누른 곳 열 지도" external />
          ) : (
            <Guide href="/utm" title="유입경로 링크" desc="광고 · 게시물마다 다른 주소를 만들어 어디서 왔는지 가른다" />
          )}
        </section>

        {/* ── 이 숫자는 어떻게 세나 ── 믿어도 되는지 */}
        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
            이 숫자는 어떻게 세나요?
            <Chevron dir="down" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <ul className="ml-4 list-disc space-y-1.5 border-t border-border px-4 py-3 text-body-sm text-muted">
            <li>방문자는 <strong className="text-foreground">브라우저</strong> 기준입니다. 같은 사람이 휴대폰과 컴퓨터로 오면 2명, 인스타 앱 안에서 열고 다시 사파리로 열어도 2명입니다.</li>
            <li>우리 기기(/internal 에서 표시한 기기)의 방문은 모두 뺐습니다.</li>
            <li>자바스크립트를 실행하지 않는 검색엔진 로봇은 잡히지 않습니다. 그래서 Vercel 의 서버 호출 수보다 적고, GA4 와도 조금 다릅니다.</li>
            <li>
              「신청 완료」 옆의 <strong className="text-foreground">실제 신청</strong>은 기록이 아니라 신청 DB 에서 센 숫자입니다.
              둘이 비슷하면 기록이 잘 잡히고 있다는 뜻이고, 크게 다르면 기록이 빠지고 있다는 뜻입니다.
            </li>
            <li>
              기록은 {o.since_first ? new Date(Date.parse(o.since_first) + KST_MS).toISOString().slice(0, 10) : "2026-11-04"} 부터
              쌓였고 90일 동안 보관합니다. 그 전 기간은 「GA4 상세 분석」 에서 봅니다.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 text-h2 font-semibold tabular-nums">{value}</p>
      <p className={`mt-0.5 text-body-sm ${warn ? "text-amber-400" : "text-muted"}`}>{sub}</p>
    </div>
  );
}

function Card({
  title,
  sub,
  more,
  children,
}: {
  title: string;
  sub?: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    // min-w-0: 그리드 칸이 내용(막대 24개 · 표) 폭만큼 버티면 휴대폰에서 가로로 넘친다
    <div className="min-w-0 rounded-xl border border-border p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h2 className="text-body font-semibold">{title}</h2>
          {sub && <p className="text-body-sm text-muted">{sub}</p>}
        </div>
        {more && (
          <Link href={more.href} className="text-body-sm text-glow hover:underline">
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-fill">
      <div className="h-full rounded-full bg-glow" style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
    </div>
  );
}

function Ranked({
  rows,
  unit,
  empty,
}: {
  rows: { key: string; label: string; n: number; extra?: string }[];
  unit: string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-body-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              <strong>
                {r.n}
                {unit}
              </strong>
              {r.extra && <span className="ml-1.5 text-muted">{r.extra}</span>}
            </span>
          </div>
          <Bar ratio={r.n / max} />
        </li>
      ))}
    </ol>
  );
}

function Guide({ href, title, desc, external }: { href: string; title: string; desc: string; external?: boolean }) {
  const cls = "block rounded-xl border border-border p-4 hover:bg-fill-subtle";
  const inner = (
    <>
      <p className="text-body font-semibold">{title}</p>
      <p className="mt-1 text-body-sm text-muted">{desc}</p>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
