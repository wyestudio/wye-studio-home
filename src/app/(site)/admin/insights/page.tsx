import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { Chevron } from "@/components/ui/Chevron";
import { withBack } from "@/lib/adminBack";
import { CLARITY_URL, STAGE_LABEL, STAGE_TAG, ago, pageLabel, visitorTag } from "../visitors/visitLabels";

export const dynamic = "force-dynamic";

type Steps = Record<string, number>;
type Overview = {
  visitors: number;
  visits: number;
  pageviews: number;
  new_visitors: number;
  mobile: number;
  applied_db: number;
  funnel: Steps;
  pages: { name: string; visitors: number; views: number }[];
  clicks: { name: string; path: string | null; visitors: number; clicks: number }[];
  hours: Record<string, number>;
  days: Record<string, number>;
  engagement: { median_secs: number; pages_per_visit: number; bounce: number; visits: number };
  exits: { name: string; visits: number }[];
  by_source: { src: string; visitors: number; pick: number; start: number; done: number }[];
  by_device: Record<"mobile" | "desktop", Steps> | null;
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
const FUNNEL = [
  { key: "theme", label: "테마 상세" },
  { key: "pick", label: "회차 고름" },
  { key: "apply_click", label: "신청하기 누름" },
  { key: "start", label: "신청서 엶" },
  { key: "consent", label: "약관 단계" },
  { key: "submit_step", label: "제출 단계" },
  { key: "done", label: "신청 완료" },
];

const GROUP_FUNNEL = [
  { key: "group_page", label: "단체 페이지" },
  { key: "group_start", label: "견적서 쓰기 시작" },
  { key: "group_submit", label: "견적 접수" },
];

/** 화면 안에서 건너뛰는 목차 — 섹션 id 와 같다 */
const JUMPS = [
  { id: "summary", label: "요약" },
  { id: "source", label: "유입" },
  { id: "funnel", label: "단계" },
  { id: "exit", label: "나간 곳" },
  { id: "click", label: "클릭" },
  { id: "people", label: "사람" },
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
  if (period === "yesterday") return { from: today - DAY_MS, to: today, prevFrom: today - 2 * DAY_MS, compare: "그 전날보다" };
  if (period === "7" || period === "30") {
    const len = Number(period) * DAY_MS;
    return { from: nowMs - len, to: nowMs, prevFrom: nowMs - 2 * len, compare: `그 전 ${period}일보다` };
  }
  // 오늘: 0시부터 지금까지 — 어제 같은 시각까지와 비교한다
  return { from: today, to: nowMs, prevFrom: today - DAY_MS, prevTo: nowMs - DAY_MS, compare: "어제 이맘때보다" };
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function duration(secs: number): string {
  if (!secs) return "-";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m ? `${m}분 ${s}초` : `${s}초`;
}

/**
 * 방문 분석 — "얼마나 왔나 → 어디서 왔나 → 어디까지 왔나 → 어디서 나갔나 → 무엇을 눌렀나" 를
 * 위에서 아래로 한 화면에(2026-11-04 대표님). 설명을 늘리지 않고 배치로 읽히게 한다:
 * 숫자는 큰 칸, 비교는 막대, 볼 곳(가장 많이 빠지는 단계 · 기록과 실제가 어긋남)은 색으로.
 * 숫자는 우리가 직접 쌓는 방문 기록(visitTrack.ts → admin_visit_overview). 우리 기기는 뺀다.
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
  const label = (path: string) => pageLabel(path, themeNames);
  const multiDay = period === "7" || period === "30";
  const tab = (key: string) => (key === "today" ? "/insights" : `/insights?p=${key}`);
  const here = tab(period);
  const done = o.funnel.done ?? 0;
  const eng = o.engagement;

  // 추이 막대 — 하루면 시간대, 여러 날이면 날짜
  const bars = multiDay
    ? Array.from({ length: Number(period) }, (_, i) => {
        const d = new Date(kstMidnight(nowMs) - (Number(period) - 1 - i) * DAY_MS + KST_MS).toISOString().slice(0, 10);
        return { label: d.slice(5).replace("-", "/"), n: o.days[d] ?? 0 };
      })
    : Array.from({ length: 24 }, (_, h) => ({ label: `${h}시`, n: o.hours[String(h)] ?? 0 }));
  const barMax = Math.max(1, ...bars.map((b) => b.n));

  // 단계 — 바로 앞 단계에서 몇 명 빠졌나, 그중 가장 많이 빠진 곳
  const steps = FUNNEL.map((f, i) => {
    const n = o.funnel[f.key] ?? 0;
    const before = i === 0 ? o.visitors : (o.funnel[FUNNEL[i - 1].key] ?? 0);
    return { ...f, n, lost: Math.max(0, before - n) };
  });
  const worst = steps.reduce((a, b) => (b.lost > a.lost ? b : a), steps[0]);
  const devices = (["mobile", "desktop"] as const).filter((d) => (o.by_device?.[d]?.visitors ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/insights" />

        {/* ── 머리 · 기간 · 목차 ──
            ⚠️ 위에 고정하지 않는다 — 사이트 머리(72px)와 어드민 메뉴(120px)가 이미 고정이라 그 뒤로 숨는다 */}
        <header className="mb-5 border-b border-border pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-h2 font-semibold">방문 분석</h1>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {PERIODS.map((p) => (
                <Link
                  key={p.key}
                  href={tab(p.key)}
                  className={`rounded-md px-3 py-1.5 text-body-sm ${
                    p.key === period ? "bg-glow font-semibold text-black" : "text-muted hover:text-foreground"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
          <nav className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
            {JUMPS.map((j) => (
              <a
                key={j.id}
                href={`#${j.id}`}
                className="shrink-0 rounded-md px-2.5 py-1 text-body-sm text-muted hover:bg-fill hover:text-foreground"
              >
                {j.label}
              </a>
            ))}
          </nav>
        </header>

        {/* ── 요약 ── */}
        <Section id="summary" title="얼마나 왔나">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="방문자"
              value={`${o.visitors}`}
              unit="명"
              delta={prev ? o.visitors - prev.visitors : null}
              deltaLabel={w.compare}
              sub={`처음 온 사람 ${pct(o.new_visitors, o.visitors)}% · 휴대폰 ${pct(o.mobile, o.visitors)}%`}
            />
            <Kpi
              label="신청 전환율"
              value={`${pct(done, o.visitors)}`}
              unit="%"
              sub={`신청 완료 ${done}명 · 실제 신청 ${o.applied_db}건`}
              warn={o.applied_db !== done}
            />
            <Kpi label="머문 시간" value={duration(eng.median_secs)} sub={`방문 한 번에 화면 ${eng.pages_per_visit}개`} />
            <Kpi
              label="바로 나감"
              value={`${pct(eng.bounce, eng.visits)}`}
              unit="%"
              sub={`방문 ${eng.visits}번 중 ${eng.bounce}번은 화면 하나만`}
            />
          </div>
          <Panel className="mt-3">
            <div className="flex h-24 items-end gap-0.5">
              {bars.map((b) => (
                <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label} · ${b.n}명`}>
                  <div className="bg-glow" style={{ height: `${(b.n / barMax) * 100}%`, minHeight: b.n ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between gap-2 text-micro tabular-nums text-muted">
              <span>{bars[0]?.label}</span>
              <span className="truncate">
                {multiDay ? "날짜별 방문자" : "시간대별 방문자"} · 가장 많을 때 {barMax}명
              </span>
              <span>{bars.at(-1)?.label}</span>
            </div>
          </Panel>
        </Section>

        {/* ── 유입 ── 어디서 와서 얼마나 신청했나 */}
        <Section id="source" title="어디서 와서 얼마나 신청했나" more={{ href: "/utm", label: "유입경로 링크" }}>
          <Panel>
            {o.by_source.length === 0 ? (
              <Empty />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead className="text-left text-label text-muted">
                    <tr>
                      <th className="whitespace-nowrap pb-2 pr-3 font-normal">들어온 곳</th>
                      <th className="whitespace-nowrap pb-2 pr-3 text-right font-normal">방문자</th>
                      <th className="hidden whitespace-nowrap pb-2 pr-3 text-right font-normal sm:table-cell">회차 고름</th>
                      <th className="whitespace-nowrap pb-2 pr-3 text-right font-normal">신청</th>
                      <th className="w-1/3 pb-2 font-normal">전환율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.by_source.map((s) => (
                      <tr key={s.src} className="border-t border-border/50">
                        <td className="py-2.5 pr-3 font-semibold">{s.src}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{s.visitors}</td>
                        <td className="hidden py-2.5 pr-3 text-right tabular-nums text-muted sm:table-cell">{s.pick}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{s.done}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Bar ratio={s.done / Math.max(1, s.visitors)} />
                            <span className="w-10 shrink-0 text-right tabular-nums">{pct(s.done, s.visitors)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </Section>

        {/* ── 단계 ── 어디까지 왔나, 어디서 가장 많이 빠지나 */}
        <Section id="funnel" title="어디까지 왔나" more={{ href: "/visitors?f=dropped", label: "신청하다 나간 사람" }}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel>
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead className="text-left text-label text-muted">
                    <tr>
                      <th className="pb-2 pr-3 font-normal">방문자 {o.visitors}명 중</th>
                      <th className="w-2/5 pb-2 pr-3 font-normal" />
                      <th className="whitespace-nowrap pb-2 pr-3 text-right font-normal">빠짐</th>
                      {devices.map((d) => (
                        // 휴대폰 화면에서는 기기 칸을 숨겨 막대 자리를 남긴다
                        <th key={d} className="hidden whitespace-nowrap pb-2 pr-3 text-right font-normal last:pr-0 sm:table-cell">
                          {d === "mobile" ? "휴대폰" : "컴퓨터"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((s) => {
                      const hot = s === worst && s.lost > 0;
                      return (
                        <tr key={s.key} className={hot ? "bg-amber-400/10" : ""}>
                          <td className="whitespace-nowrap py-2 pl-1 pr-3">
                            {s.label}
                            <span className="ml-2 font-semibold tabular-nums">{s.n}명</span>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <Bar ratio={s.n / Math.max(1, o.visitors)} hot={hot} />
                              <span className="w-10 shrink-0 text-right tabular-nums text-muted">{pct(s.n, o.visitors)}%</span>
                            </div>
                          </td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${hot ? "font-semibold text-amber-400" : "text-muted"}`}>
                            {s.lost ? `−${s.lost}` : ""}
                          </td>
                          {devices.map((d) => {
                            const dv = o.by_device?.[d];
                            return (
                              <td key={d} className="hidden py-2 pr-3 text-right tabular-nums text-muted last:pr-1 sm:table-cell">
                                {dv ? `${pct(dv[s.key] ?? 0, dv.visitors)}%` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(worst.lost > 0 || (o.funnel.sold_out ?? 0) > 0) && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
                  {worst.lost > 0 && <span className="text-amber-400">가장 많이 빠지는 곳: {worst.label} 직전 {worst.lost}명</span>}
                  {(o.funnel.sold_out ?? 0) > 0 && <span className="text-muted">마감 회차를 눌러 본 사람 {o.funnel.sold_out}명</span>}
                </div>
              )}
            </Panel>
            <Panel title="단체 예약">
              <ol className="flex flex-col gap-3">
                {GROUP_FUNNEL.map((f) => {
                  const n = o.funnel[f.key] ?? 0;
                  return (
                    <li key={f.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
                        <span>{f.label}</span>
                        <strong className="tabular-nums">{n}명</strong>
                      </div>
                      <Bar ratio={n / Math.max(1, o.funnel.group_page ?? 0)} />
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </div>
        </Section>

        {/* ── 나간 곳 · 많이 본 화면 ── */}
        <Section id="exit" title="어디서 나갔나">
          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="마지막으로 본 화면">
              <Ranked
                rows={o.exits.map((e) => ({ key: e.name, label: label(e.name), n: e.visits, extra: `${pct(e.visits, eng.visits)}%` }))}
                unit="번"
              />
            </Panel>
            <Panel title="많이 본 화면">
              <Ranked
                rows={o.pages.map((p) => ({ key: p.name, label: label(p.name), n: p.visitors, extra: `${p.views}번` }))}
                unit="명"
              />
            </Panel>
          </div>
        </Section>

        {/* ── 클릭 ── */}
        <Section id="click" title="무엇을 눌렀나">
          <Panel>
            {o.clicks.length === 0 ? (
              <Empty />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead className="text-left text-label text-muted">
                    <tr>
                      <th className="pb-2 pr-3 font-normal">버튼 · 링크</th>
                      <th className="pb-2 pr-3 font-normal">화면</th>
                      <th className="pb-2 pr-3 text-right font-normal">누른 사람</th>
                      <th className="pb-2 text-right font-normal">횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.clicks.map((c, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="py-2.5 pr-3 font-semibold">{c.name}</td>
                        <td className="py-2.5 pr-3 text-muted">{c.path ? label(c.path) : "-"}</td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">{c.visitors}명</td>
                        <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-muted">{c.clicks}번</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </Section>

        {/* ── 사람 · 다른 화면 ── */}
        <Section id="people" title="최근 방문자" more={{ href: "/visitors", label: "전체 보기" }}>
          <Panel>
            {recent.length === 0 ? (
              <Empty />
            ) : (
              <ul className="flex flex-col">
                {recent.map((r) => (
                  <li key={r.visitor_id} className="border-t border-border/50 first:border-0">
                    <Link
                      href={withBack(`/visitors/${r.visitor_id}`, here)}
                      className="flex items-center gap-2 py-2.5 text-body-sm hover:bg-fill-subtle"
                    >
                      <span className={`w-28 shrink-0 truncate ${r.customer_name ? "font-semibold" : "text-muted"}`}>
                        {r.customer_name ?? visitorTag(r.visitor_id)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {r.first_source} → {label(r.last_path ?? "-")}
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-micro font-semibold ${STAGE_TAG[r.stage] ?? STAGE_TAG[0]}`}>
                        {r.applied && r.stage < 6 ? "신청함" : STAGE_LABEL[r.stage] ?? "둘러봄"}
                      </span>
                      <span className="hidden w-14 shrink-0 text-right tabular-nums text-muted sm:block">{ago(r.last_at, nowMs)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Guide href="/visitors" title="방문 발자취" desc="한 사람씩 지나간 길" />
            <Guide href="/customers" title="고객" desc="신청한 사람 · 재참여" />
            <Guide href="/analytics" title="GA4 상세" desc="긴 기간 추이 · 캠페인" />
            {CLARITY_URL ? (
              <Guide href={CLARITY_URL} title="Clarity ↗" desc="화면 녹화 · 열 지도" external />
            ) : (
              <Guide href="/utm" title="유입경로 링크" desc="광고마다 다른 주소" />
            )}
          </div>
        </Section>

        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body-sm text-muted [&::-webkit-details-marker]:hidden">
            이 숫자는 어떻게 세나요?
            <Chevron dir="down" className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="ml-4 list-disc space-y-1.5 border-t border-border px-4 py-3 text-body-sm text-muted">
            <li>방문자는 브라우저 기준입니다. 같은 사람이 휴대폰과 컴퓨터로 오면 2명입니다.</li>
            <li>우리 기기(/internal 에서 표시한 기기)는 뺐고, 자바스크립트를 실행하지 않는 로봇은 잡히지 않습니다. 그래서 GA4 와 조금 다릅니다.</li>
            <li>「실제 신청」은 신청 DB 에서 센 숫자입니다. 「신청 완료」와 크게 다르면 기록이 빠지고 있다는 뜻입니다.</li>
            <li>머문 시간은 방문들의 가운데 값이고, 화면 하나만 열고 닫은 방문은 시간을 잴 수 없어 뺍니다.</li>
            <li>
              기록은 {o.since_first ? new Date(Date.parse(o.since_first) + KST_MS).toISOString().slice(0, 10) : "2026-11-04"} 부터
              쌓였고 90일 보관합니다. 그 전은 「GA4 상세」에서 봅니다.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    // scroll-mt: 목차로 건너뛸 때 위에 고정된 사이트 머리(72px) · 어드민 메뉴(120px, 컴퓨터만)에 제목이 가리지 않게
    <section id={id} className="mb-8 scroll-mt-24 md:scroll-mt-52">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold">{title}</h2>
        {more && (
          <Link href={more.href} className="shrink-0 text-body-sm text-glow hover:underline">
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Panel({ title, className = "", children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    // min-w-0: 그리드 칸이 내용(막대 · 표) 폭만큼 버티면 휴대폰에서 가로로 넘친다
    <div className={`min-w-0 rounded-xl border border-border p-4 md:p-5 ${className}`}>
      {title && <h3 className="mb-3 text-body font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
  delta,
  deltaLabel,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  delta?: number | null;
  deltaLabel?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-h1 font-semibold tabular-nums">
          {value}
          {unit && <span className="ml-0.5 text-body font-normal text-muted">{unit}</span>}
        </span>
        {delta != null && (
          <span
            className={`text-body-sm font-semibold tabular-nums ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted"}`}
          >
            {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
            <span className="ml-1 font-normal text-muted">{deltaLabel}</span>
          </span>
        )}
      </p>
      <p className={`mt-1 text-body-sm ${warn ? "text-amber-400" : "text-muted"}`}>{sub}</p>
    </div>
  );
}

function Bar({ ratio, hot }: { ratio: number; hot?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
      <div
        className={`h-full rounded-full ${hot ? "bg-amber-400" : "bg-glow"}`}
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
      />
    </div>
  );
}

function Ranked({ rows, unit }: { rows: { key: string; label: string; n: number; extra?: string }[]; unit: string }) {
  if (rows.length === 0) return <Empty />;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-2.5">
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

function Empty() {
  return <p className="py-4 text-center text-body-sm text-muted">아직 기록이 없습니다.</p>;
}

function Guide({ href, title, desc, external }: { href: string; title: string; desc: string; external?: boolean }) {
  const cls = "block rounded-xl border border-border px-4 py-3 hover:bg-fill-subtle";
  const inner = (
    <>
      <p className="text-body-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-body-sm text-muted">{desc}</p>
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
