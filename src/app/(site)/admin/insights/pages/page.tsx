import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { CLARITY_URL, mascotName, pageLabel } from "../../visitors/visitLabels";
import { Bar, Empty, Kpi, PERIODS, Panel, Section, duration, getNowMs, pct, windowOf } from "../parts";

export const dynamic = "force-dynamic";

type Report = {
  visitors: number;
  views: number;
  entries: number;
  exits: number;
  median_secs: number;
  scroll: { n: number; p25: number; p50: number; p75: number; p100: number };
  sections: { label: string; idx: number | null; visitors: number }[];
  clicks: { name: string; visitors: number; clicks: number; y: number | null }[];
  fields: { field: string; visitors: number }[];
  mascots: { mascot: string; visitors: number; times: number; throwers: number }[];
  events: Record<string, number>;
};

/** 단체 견적 입력 칸(GroupQuoteFlow 의 data-track-field) — 필수 칸만 단계로, 선택 칸은 따로 센다 */
const GROUP_REQUIRED = ["담당자 이름", "연락처"];
const GROUP_OPTIONAL = ["모임 이름", "기타 모임 성격", "기념일", "요청사항"];

/** 이 화면에서 일어난 분석 이벤트 이름 → 짧은 말 */
const EVENT_LABEL: Record<string, string> = {
  detail_session_pick: "회차 고름",
  detail_sold_out_click: "마감 회차 클릭",
  detail_apply_click: "신청하기 누름",
  detail_booking_scroll: "회차 안 고르고 신청하기",
  "신청 시작": "신청서 엶",
  "신청 약관동의": "약관 단계",
  "신청 제출단계": "제출 단계",
  "신청 완료": "신청 완료",
  group_entry_click: "단체 페이지로 들어옴",
  group_cta_click: "견적 신청하기 누름",
  group_quote_start: "견적서 쓰기 시작",
  group_quote_error: "견적 제출 막힘",
  group_quote_submit: "견적 접수",
};

/** 따로 모아 보여 주는 클릭 — 모드 전환 · 단체 옵션 */
const isModeClick = (name: string) => name.startsWith("모드 전환");
const isOptionClick = (name: string) => / (넣기|빼기)$|시간 하나 (늘리기|줄이기)$/.test(name);

/**
 * 페이지 보고서 — 화면 하나에서 사람들이 무엇을 했나(2026-11-04 대표님).
 * 홈 · 테마 상세 · 단체 예약 중 하나를 골라: 체류 시간 · 스크롤 깊이 · 블록별 도달 · 기능 사용
 * (마스코트 · 모드 전환 · 옵션) · 입력 진행 · 클릭 위치. 데이터는 admin_page_report.
 */
export default async function AdminPageReport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.key === sp.p) ? (sp.p as string) : "today";
  const path = typeof sp.path === "string" && sp.path.startsWith("/") ? sp.path.slice(0, 200) : "/";
  const nowMs = getNowMs();
  const w = windowOf(period, nowMs);
  const iso = (ms: number) => new Date(ms).toISOString();

  const supabase = createAdminClient();
  const [repRes, ovRes, themesRes] = await Promise.all([
    supabase.rpc("admin_page_report", { p_since: iso(w.from), p_until: iso(w.to), p_path: path }),
    // 고를 수 있는 화면 — 이 기간에 많이 본 화면들
    supabase.rpc("admin_visit_overview", { p_since: iso(w.from), p_until: iso(w.to) }),
    supabase.from("themes").select("slug, name, variant_label"),
  ]);

  const themeNames = new Map(
    ((themesRes.data ?? []) as { slug: string; name: string; variant_label: string | null }[]).map((t) => [
      t.slug,
      [t.name, t.variant_label].filter(Boolean).join(" "),
    ]),
  );
  const label = (p: string) => pageLabel(p, themeNames);
  const href = (next: { path?: string; p?: string }) => {
    const q = new URLSearchParams({ path: next.path ?? path });
    const per = next.p ?? period;
    if (per !== "today") q.set("p", per);
    return `/insights/pages?${q.toString()}`;
  };
  const backHref = period === "today" ? "/insights" : `/insights?p=${period}`;

  if (repRes.error) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/insights" />
          <div className="text-red-400">페이지 보고서를 불러올 수 없습니다: {repRes.error.message}</div>
        </div>
      </div>
    );
  }

  const r = repRes.data as Report;
  const picks = [
    "/",
    "/group",
    ...(((ovRes.data as { pages?: { name: string }[] } | null)?.pages ?? []).map((p) => p.name)),
    path,
  ].filter((p, i, a) => a.indexOf(p) === i && !p.startsWith("/site-gate"));

  const modes = r.clicks.filter((c) => isModeClick(c.name));
  const options = r.clicks.filter((c) => isOptionClick(c.name));
  // 마스코트 · 모드 전환 · 옵션은 「기능 사용」 에 따로 있다 — 클릭 순위에서는 뺀다
  const otherClicks = r.clicks.filter(
    (c) => !isModeClick(c.name) && !isOptionClick(c.name) && !c.name.endsWith("마스코트를 커서로 선택"),
  );
  const events = Object.entries(r.events).sort((a, b) => b[1] - a[1]);
  const scrollBase = Math.max(1, r.scroll.n);
  const isGroup = path === "/group";
  const fieldCount = new Map(r.fields.map((f) => [f.field, f.visitors]));
  const quoteStart = r.events.group_quote_start ?? 0;
  const formRows = isGroup
    ? [
        { label: "견적서 쓰기 시작", n: quoteStart },
        ...GROUP_REQUIRED.map((f) => ({ label: f, n: fieldCount.get(f) ?? 0 })),
        { label: "견적 접수", n: r.events.group_quote_submit ?? 0 },
      ]
    : r.fields.map((f) => ({ label: f.field, n: f.visitors }));
  const formBase = Math.max(1, isGroup ? quoteStart : r.visitors);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/insights" />

        <header className="mb-5 border-b border-border pb-3">
          <Link href={backHref} className="text-body-sm text-glow hover:underline">
            ← 방문 분석
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-h2 font-semibold">페이지 보고서 · {label(path)}</h1>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {PERIODS.map((p) => (
                <Link
                  key={p.key}
                  href={href({ p: p.key })}
                  className={`rounded-md px-3 py-1.5 text-body-sm ${
                    p.key === period ? "bg-glow font-semibold text-black" : "text-muted hover:text-foreground"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
          <nav className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
            {picks.map((p) => (
              <Link
                key={p}
                href={href({ path: p })}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-body-sm ${
                  p === path ? "border-glow bg-fill font-semibold text-foreground" : "border-border text-muted hover:text-foreground"
                }`}
              >
                {label(p)}
              </Link>
            ))}
          </nav>
        </header>

        {/* ── 현황 ── */}
        <Section id="summary" title="페이지 현황">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="본 사람" value={`${r.visitors}`} unit="명" sub={`화면 ${r.views}번 열림`} />
            <Kpi label="체류 시간" value={duration(r.median_secs)} sub="화면이 보이던 시간의 중간값" />
            <Kpi label="끝까지 내려봄" value={`${pct(r.scroll.p100, r.scroll.n)}`} unit="%" sub={`${r.scroll.p100}명 / ${r.scroll.n}명`} />
            <Kpi
              label="여기서 나감"
              value={`${pct(r.exits, r.views)}`}
              unit="%"
              sub={`방문 ${r.exits}번이 이 화면에서 끝남`}
            />
          </div>
        </Section>

        {/* ── 스크롤 · 블록 도달 ── */}
        <Section id="reach" title="스크롤 · 블록 도달">
          <div className={`grid gap-3 ${r.sections.length ? "md:grid-cols-2" : ""}`}>
            <Panel title="어디까지 내려봤나">
              {r.scroll.n === 0 ? (
                <Empty />
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {[
                    { k: "25%", n: r.scroll.p25 },
                    { k: "50%", n: r.scroll.p50 },
                    { k: "75%", n: r.scroll.p75 },
                    { k: "끝까지", n: r.scroll.p100 },
                  ].map((b) => (
                    <li key={b.k}>
                      <div className="mb-1 flex justify-between text-body-sm">
                        <span>{b.k}</span>
                        <span className="tabular-nums">
                          <strong>{b.n}명</strong> <span className="text-muted">{pct(b.n, scrollBase)}%</span>
                        </span>
                      </div>
                      <Bar ratio={b.n / scrollBase} />
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            {r.sections.length > 0 && (
              <Panel title="블록별로 본 사람">
                <ol className="flex flex-col gap-2.5">
                  {r.sections.map((sct) => (
                    <li key={sct.label}>
                      <div className="mb-1 flex justify-between gap-2 text-body-sm">
                        <span className="min-w-0 truncate">{sct.label}</span>
                        <span className="shrink-0 tabular-nums">
                          <strong>{sct.visitors}명</strong> <span className="text-muted">{pct(sct.visitors, r.visitors)}%</span>
                        </span>
                      </div>
                      <Bar ratio={sct.visitors / Math.max(1, r.visitors)} />
                    </li>
                  ))}
                </ol>
              </Panel>
            )}
          </div>
        </Section>

        {/* ── 기능 사용 ── 마스코트 · 모드 전환 · 단체 옵션 · 이 화면의 행동 */}
        {(r.mascots.length > 0 || modes.length > 0 || options.length > 0 || events.length > 0) && (
          <Section id="features" title="기능 사용">
            <div className="grid gap-3 md:grid-cols-2">
              {r.mascots.length > 0 && (
                <Panel title="마스코트">
                  <UseList
                    rows={r.mascots.map((m) => ({
                      k: `${mascotName(m.mascot)} · 커서로 고름`,
                      n: m.visitors,
                      extra: m.throwers ? `던져봄 ${m.throwers}명` : `${m.times}번`,
                    }))}
                    base={r.visitors}
                  />
                </Panel>
              )}
              {modes.length > 0 && (
                <Panel title="모드 전환">
                  <UseList
                    rows={modes.map((m) => ({
                      k: m.name.replace("모드 전환 → ", ""),
                      n: m.visitors,
                      extra: m.y != null ? `화면 ${m.y}% 지점` : `${m.clicks}번`,
                    }))}
                    base={r.visitors}
                  />
                </Panel>
              )}
              {options.length > 0 && (
                <Panel title="옵션 넣기 · 빼기">
                  <UseList rows={options.map((o) => ({ k: o.name, n: o.visitors, extra: `${o.clicks}번` }))} base={r.visitors} />
                </Panel>
              )}
              {events.length > 0 && (
                <Panel title="이 화면에서 한 행동">
                  <UseList rows={events.map(([k, n]) => ({ k: EVENT_LABEL[k] ?? k, n }))} base={r.visitors} />
                </Panel>
              )}
            </div>
          </Section>
        )}

        {/* ── 입력 진행 ── 단체 견적처럼 입력칸이 있는 화면 */}
        {formRows.length > 0 && formRows.some((f) => f.n > 0) && (
          <Section id="form" title="입력 진행">
            <Panel>
              <ol className="flex flex-col gap-2.5">
                {formRows.map((f, i) => {
                  const prevN = i === 0 ? null : formRows[i - 1].n;
                  return (
                    <li key={f.label}>
                      <div className="mb-1 flex justify-between gap-2 text-body-sm">
                        <span>{f.label}</span>
                        <span className="tabular-nums">
                          <strong>{f.n}명</strong>
                          {prevN != null && prevN > f.n && <span className="ml-1.5 text-amber-400">−{prevN - f.n}</span>}
                        </span>
                      </div>
                      <Bar ratio={f.n / formBase} />
                    </li>
                  );
                })}
              </ol>
              {isGroup && (
                <p className="mt-3 text-body-sm">
                  <span className="text-muted">선택 칸 입력 · </span>
                  {GROUP_OPTIONAL.map((f) => `${f} ${fieldCount.get(f) ?? 0}명`).join(" · ")}
                </p>
              )}
              <p className="mt-1 text-body-sm text-muted">입력한 내용은 기록하지 않고, 칸을 채웠는지만 셉니다.</p>
            </Panel>
          </Section>
        )}

        {/* ── 클릭 ── 누른 것과 누른 위치 */}
        <Section id="click" title="클릭 순위">
          <Panel>
            {otherClicks.length === 0 ? (
              <Empty />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead className="text-left text-label text-muted">
                    <tr>
                      <th className="pb-2 pr-3 font-normal">버튼 · 링크</th>
                      <th className="whitespace-nowrap pb-2 pr-3 text-right font-normal">누른 사람</th>
                      <th className="hidden w-1/4 whitespace-nowrap pb-2 font-normal sm:table-cell">누른 위치(화면 위 → 아래)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherClicks.map((c) => (
                      <tr key={c.name} className="border-t border-border/50">
                        <td className="py-2.5 pr-3 font-semibold">{c.name}</td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">
                          {c.visitors}명 <span className="text-muted">· {c.clicks}번</span>
                        </td>
                        <td className="hidden py-2.5 sm:table-cell">
                          {c.y != null && (
                            <div className="relative h-2 rounded-full bg-fill" title={`화면 ${c.y}% 지점`}>
                              <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-glow" style={{ left: `${c.y}%` }} />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {CLARITY_URL && (
            <a href={CLARITY_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block text-body-sm text-glow hover:underline">
              Clarity 열 지도로 보기 ↗
            </a>
          )}
        </Section>
      </div>
    </div>
  );
}

/** 이름 · 사람 수 · 막대 한 줄씩. base 대비 % 를 같이 보인다 */
function UseList({ rows, base }: { rows: { k: string; n: number; extra?: string }[]; base: number }) {
  const b = Math.max(1, base);
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.k}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
            <span className="min-w-0 truncate">{r.k}</span>
            <span className="shrink-0 tabular-nums">
              <strong>{r.n}명</strong>
              <span className="ml-1.5 text-muted">{r.extra ?? `${pct(r.n, b)}%`}</span>
            </span>
          </div>
          <Bar ratio={r.n / b} />
        </li>
      ))}
    </ol>
  );
}
