"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import v from "./XmasGameAdmin.module.css";

/**
 * 크리스마스 게임 어드민의 그림들 — 「한눈에 보기」 · 「참여자」 탭(2026-11-27 대표님 — "글만 쓰지 말고 차트 · 표로 첫눈에").
 * 데이터는 DB 의 xmas_game_admin()(supabase/migrations/20261127063948_xmas_game_admin_overview.sql).
 * 색은 XmasGameAdmin.module.css 의 --s1~--s6 만 쓴다(순서 고정). 숫자 · 글자는 색이 아니라 글자색(text-foreground · muted)으로.
 */

/** 판 하나가 어떻게 끝났나 — 순서는 손님이 지나가는 순서(그만둠 → 35점 미만 → 통과한 갈래들) */
export const OUTCOMES = [
  {
    key: "quit",
    label: "5라운드 전에 그만둠",
    color: "var(--s1)",
    note: "창을 닫았거나 다시 시작 — 지금 하고 있는 판도 여기 든다",
  },
  { key: "below", label: "5라운드 35점 미만", color: "var(--s2)", note: "" },
  {
    key: "gift",
    label: "정답 맞혀 선물 코드 받음",
    color: "var(--s3)",
    note: "",
  },
  {
    key: "had_gift",
    label: "통과 · 이미 코드 있음",
    color: "var(--s4)",
    note: "앞 판에서 받은 사람(선물은 브라우저에 하나)",
  },
  {
    key: "skip",
    label: "통과 · 정답 안 냄",
    color: "var(--s5)",
    note: "「기록만 남기기」 또는 정답 화면에서 나감",
  },
  {
    key: "wrong",
    label: "통과 · 오답 내고 멈춤",
    color: "var(--s6)",
    note: "",
  },
] as const;
export type OutcomeKey = (typeof OUTCOMES)[number]["key"];

export type PlayerRow = {
  player_id: string;
  nickname: string | null;
  hidden: boolean;
  runs: number;
  finished: number;
  below: number;
  passed: number;
  skipped: number;
  wrong_runs: number;
  wrong_answers: number;
  bonus: number;
  retries: number;
  best5: number | null;
  best_round: number;
  best_score: number | null;
  gift: boolean;
  redeemed: boolean;
  react_ms: number | null;
  first_at: string;
  last_at: string;
};

export type GameOverview = {
  players: PlayerRow[];
  outcomes: Partial<Record<OutcomeKey, number>>;
  rounds: { round: number; reached: number; ended: number }[];
  scores: { score: number; runs: number }[];
  total_runs: number;
  retries: number;
};

const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-";

const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
/** "11/27 15:20" — 표 칸이 좁아 짧게 */
const shortKst = (iso: string) => {
  const p = Object.fromEntries(KST.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
};

/** 차트 칸 — 제목 · 한 줄 설명 · 그림. */
export function Panel({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-fill-subtle p-4 md:p-5">
      <h3 className="text-h3 font-semibold">{title}</h3>
      {desc && <p className="mt-1 text-body-sm text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TOOLTIP = {
  contentStyle: {
    backgroundColor: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    color: "var(--foreground)",
    fontSize: 13,
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--line-subtle)" },
};

/** 판은 어떻게 끝났나 — 한 줄 100% 막대 + 숫자를 적은 범례. */
export function OutcomeBar({ overview }: { overview: GameOverview }) {
  const total = overview.total_runs;
  return (
    <div className={v.viz}>
      <div className={v.stack} role="img" aria-label="판 결과 비율">
        {OUTCOMES.map((o) => {
          const n = overview.outcomes[o.key] ?? 0;
          return n > 0 ? (
            <span
              key={o.key}
              title={`${o.label} ${n}판 (${pct(n, total)})`}
              style={{ width: `${(n / total) * 100}%`, background: o.color }}
            />
          ) : null;
        })}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {OUTCOMES.map((o) => {
          const n = overview.outcomes[o.key] ?? 0;
          return (
            <li key={o.key} className="flex items-start gap-2">
              <span
                className={`${v.swatch} mt-1.5`}
                style={{ background: o.color }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="text-body-sm font-semibold">{o.label}</span>
                <span className="ml-2 text-body-sm tabular-nums">
                  {n}판 <span className="text-muted">{pct(n, total)}</span>
                </span>
                {o.note && (
                  <span className="block text-label text-muted">{o.note}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 라운드별 도달 · 멈춤 — 막대 하나가 그 라운드까지 닿은 판. 위쪽(진한 색)이 거기서 멈춘 판, 아래가 다음 라운드로 간 판.
 * 맨 앞 「시작」 은 시작한 판 전부와, 5라운드를 마치기 전에 그만둔 판.
 */
export function RoundChart({ overview }: { overview: GameOverview }) {
  const [table, setTable] = useState(false);
  const quit = overview.outcomes.quit ?? 0;
  const data = [
    {
      name: "시작",
      넘어감: overview.total_runs - quit,
      멈춤: quit,
      reached: overview.total_runs,
    },
    ...overview.rounds.map((r) => ({
      name: `${r.round}R`,
      넘어감: r.reached - r.ended,
      멈춤: r.ended,
      reached: r.reached,
    })),
  ];
  return (
    <div className={v.viz}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-body-sm">
        <span className="flex items-center gap-2">
          <span
            className={v.swatch}
            style={{ background: "var(--s1)" }}
            aria-hidden
          />
          다음 라운드로 감
        </span>
        <span className="flex items-center gap-2">
          <span
            className={v.swatch}
            style={{ background: "var(--s2)" }}
            aria-hidden
          />
          이 라운드에서 멈춤
        </span>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="ml-auto rounded-md border border-line px-2.5 py-1 text-label font-semibold text-muted hover:bg-fill"
        >
          {table ? "차트로 보기" : "표로 보기"}
        </button>
      </div>
      {table ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[420px] text-left text-body-sm">
            <thead className="bg-fill text-label text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">라운드</th>
                <th className="px-3 py-2 text-right font-semibold">닿은 판</th>
                <th className="px-3 py-2 text-right font-semibold">
                  여기서 멈춤
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  다음으로 간 비율
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.name}
                  className="border-t border-line-subtle tabular-nums"
                >
                  <td className="px-3 py-2 font-semibold">{d.name}</td>
                  <td className="px-3 py-2 text-right">{d.reached}</td>
                  <td className="px-3 py-2 text-right">{d.멈춤}</td>
                  <td className="px-3 py-2 text-right text-muted">
                    {pct(d.넘어감, d.reached)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid vertical={false} stroke="var(--line-subtle)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              {...TOOLTIP}
              formatter={(value, name) => [
                `${value}판`,
                name === "멈춤" ? "여기서 멈춤" : "다음 라운드로 감",
              ]}
            />
            <Bar isAnimationActive={false}
              dataKey="넘어감"
              stackId="a"
              fill="var(--s1)"
              maxBarSize={36}
            />
            <Bar isAnimationActive={false}
              dataKey="멈춤"
              stackId="a"
              fill="var(--s2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** 5라운드 점수 분포 — 점수마다 판 수. 35점(선물 기준)에 선을 긋는다. */
export function ScoreChart({ overview }: { overview: GameOverview }) {
  // 0~52점을 빠짐없이 — 빈 점수도 칸을 둬야 모양이 보인다
  const byScore = new Map(overview.scores.map((s) => [s.score, s.runs]));
  const min = Math.min(0, ...overview.scores.map((s) => s.score));
  const data = Array.from({ length: 52 - min + 1 }, (_, i) => ({
    score: min + i,
    판: byScore.get(min + i) ?? 0,
  }));
  const finished = overview.scores.reduce((a, s) => a + s.runs, 0);
  const passed = overview.scores
    .filter((s) => s.score >= 35)
    .reduce((a, s) => a + s.runs, 0);
  return (
    <div className={v.viz}>
      <p className="mb-3 text-body-sm">
        5라운드를 마친{" "}
        <span className="font-semibold tabular-nums">{finished}판</span> 중{" "}
        <span className="font-semibold tabular-nums">{passed}판</span>이 35점을
        넘겼습니다{" "}
        <span className="text-muted tabular-nums">
          ({pct(passed, finished)})
        </span>
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 8, bottom: 0, left: -16 }}
          barCategoryGap={1}
        >
          <CartesianGrid vertical={false} stroke="var(--line-subtle)" />
          <XAxis
            dataKey="score"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval={4}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            {...TOOLTIP}
            labelFormatter={(s) => `${s}점`}
            formatter={(value) => [`${value}판`, "판 수"]}
          />
          <ReferenceLine
            x={35}
            stroke="var(--foreground)"
            strokeDasharray="4 3"
            label={{
              value: "선물 기준 35점",
              position: "top",
              fill: "var(--muted)",
              fontSize: 12,
            }}
          />
          <Bar isAnimationActive={false} dataKey="판" fill="var(--s1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 가로 막대 목록 — 참여 단계처럼 단계마다 사람 수. 단계가 차례로 줄어드는 깔때기가 아니다(공유 링크로 온 사람은
 * 블록을 안 보고 게임 화면에 온다) — 그래서 비율은 적지 않고, 막대 길이는 가장 많은 줄 대비다.
 */
export function FunnelBars({ rows }: { rows: { label: string; note?: string; value: number; extra?: number }[] }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className={`${v.viz} flex flex-col gap-3`}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-body-sm font-semibold">
              {r.label}
              {r.note && <span className="ml-2 text-label font-normal text-muted">{r.note}</span>}
            </span>
            <span className="shrink-0 text-body-sm tabular-nums">
              <span className="font-semibold">{r.value}명</span>
              {r.extra !== undefined && <span className="ml-2 text-label text-muted">우리 기기 포함 {r.extra}</span>}
            </span>
          </div>
          <div className={v.track}>
            <div className={v.fill} style={{ width: max > 0 ? `${(r.value / max) * 100}%` : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 비율 칸 — 큰 숫자 + 막대 + "몇 명 중 몇 명". */
export function RatioCards({
  items,
}: {
  items: { label: string; part: number; whole: number; who: string }[];
}) {
  return (
    <dl className={`${v.viz} grid grid-cols-1 gap-3 md:grid-cols-3`}>
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-line bg-background px-4 py-3"
        >
          <dt className="text-label text-muted">{it.label}</dt>
          <dd className="mt-1 text-h2 font-extrabold tabular-nums">
            {pct(it.part, it.whole)}
          </dd>
          <dd className={`${v.track} mt-2`}>
            <div
              className={v.fill}
              style={{
                width: it.whole > 0 ? `${(it.part / it.whole) * 100}%` : 0,
              }}
            />
          </dd>
          <dd className="mt-2 text-label text-muted tabular-nums">
            {it.who} {it.whole}명 중 {it.part}명
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ── 참여자 표 ── */

const FILTERS: {
  key: string;
  label: string;
  test: (p: PlayerRow) => boolean;
}[] = [
  { key: "all", label: "전체", test: () => true },
  { key: "unranked", label: "랭킹 미등록", test: (p) => !p.nickname },
  { key: "notyet", label: "5라운드 못 마침", test: (p) => p.finished === 0 },
  {
    key: "below",
    label: "35점 못 넘김",
    test: (p) => p.finished > 0 && p.passed === 0,
  },
  {
    key: "nogift",
    label: "통과했지만 코드 없음",
    test: (p) => p.passed > 0 && !p.gift,
  },
  { key: "skip", label: "정답 안 내고 기록만", test: (p) => p.skipped > 0 },
  { key: "gift", label: "코드 받음", test: (p) => p.gift },
  { key: "hidden", label: "숨김", test: (p) => p.hidden },
];

const SORTS: {
  key: string;
  label: string;
  cmp: (a: PlayerRow, b: PlayerRow) => number;
}[] = [
  {
    key: "recent",
    label: "최근 플레이순",
    cmp: (a, b) => b.last_at.localeCompare(a.last_at),
  },
  {
    key: "runs",
    label: "시도 많은 순",
    cmp: (a, b) => b.runs - a.runs || b.last_at.localeCompare(a.last_at),
  },
  {
    key: "score",
    label: "최고 점수순",
    cmp: (a, b) =>
      (b.best_score ?? -1) - (a.best_score ?? -1) ||
      b.best_round - a.best_round,
  },
];

/** 한 사람의 판들이 어떻게 끝났나 — 그만둠 · 35점 미만 · 통과 */
function PlayerMix({ p }: { p: PlayerRow }) {
  const parts = [
    { n: p.runs - p.finished, color: "var(--s1)", label: "그만둠" },
    { n: p.below, color: "var(--s2)", label: "35점 미만" },
    { n: p.passed, color: "var(--s3)", label: "통과" },
  ];
  return (
    <span
      className={v.mini}
      title={parts.map((x) => `${x.label} ${x.n}`).join(" · ")}
      aria-hidden
    >
      {parts.map((x) =>
        x.n > 0 ? (
          <span key={x.label} style={{ flex: x.n, background: x.color }} />
        ) : null,
      )}
    </span>
  );
}

export function PlayerTable({ players }: { players: PlayerRow[] }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    const s = SORTS.find((x) => x.key === sort) ?? SORTS[0];
    return players.filter(f.test).sort(s.cmp);
  }, [players, filter, sort]);

  return (
    <div className={v.viz}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = players.filter(f.test).length;
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-label font-semibold transition-colors ${
                on
                  ? "border-glow bg-glow text-glow-foreground"
                  : "border-line text-muted hover:bg-fill"
              }`}
            >
              {f.label} <span className="tabular-nums">{n}</span>
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-2 text-label text-muted">
          정렬
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-line bg-background px-2 py-1.5 text-label text-foreground"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mb-2 flex flex-wrap gap-4 text-label text-muted">
        <span>판 결과 막대:</span>
        {[
          ["var(--s1)", "그만둠"],
          ["var(--s2)", "35점 미만"],
          ["var(--s3)", "35점 통과"],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={v.swatch} style={{ background: c }} aria-hidden />
            {l}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-body-sm text-muted">해당하는 사람이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[900px] text-left text-body-sm">
            <thead className="bg-fill text-label text-muted">
              <tr>
                <th className="px-2 py-2 font-semibold">사람</th>
                <th className="px-2 py-2 text-right font-semibold">시도</th>
                <th className="px-2 py-2 font-semibold">판 결과</th>
                <th className="px-2 py-2 text-right font-semibold">
                  35점 미만
                </th>
                <th className="px-2 py-2 text-right font-semibold">통과</th>
                <th className="px-2 py-2 text-right font-semibold">기록만</th>
                <th className="px-2 py-2 text-right font-semibold">오답</th>
                <th className="px-2 py-2 text-right font-semibold">최고 5R</th>
                <th className="px-2 py-2 text-right font-semibold">
                  최고 라운드
                </th>
                <th className="px-2 py-2 text-right font-semibold">
                  최고 점수
                </th>
                <th className="px-2 py-2 font-semibold">선물</th>
                <th
                  className="px-2 py-2 text-right font-semibold"
                  title="최근 판의 반응 속도 중앙값 — 사람은 대개 300~600ms"
                >
                  반응
                </th>
                <th className="px-2 py-2 font-semibold">마지막</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.player_id}
                  className={`border-t border-line-subtle tabular-nums ${p.hidden ? "text-disabled" : ""}`}
                >
                  <td className="px-2 py-2">
                    {p.nickname ? (
                      <span className="font-semibold">{p.nickname}</span>
                    ) : (
                      <span className="text-muted">미등록</span>
                    )}
                    <span className="ml-2 font-mono text-label text-muted">
                      {p.player_id.slice(0, 6)}
                    </span>
                    {p.hidden && (
                      <span className="ml-2 text-label text-muted">숨김</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {p.runs}
                  </td>
                  <td className="px-2 py-2">
                    <PlayerMix p={p} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.below || <span className="text-muted">0</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.passed || <span className="text-muted">0</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.skipped || <span className="text-muted">0</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.wrong_answers || <span className="text-muted">0</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.best5 ?? <span className="text-muted">-</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.best_round >= 5 ? (
                      p.best_round
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.best_score ?? <span className="text-muted">-</span>}
                  </td>
                  <td className="px-2 py-2">
                    {p.redeemed ? (
                      <span className="text-muted">수령</span>
                    ) : p.gift ? (
                      <span className="text-confirm">받음</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {p.react_ms ? (
                      `${p.react_ms}ms`
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-muted">
                    {shortKst(p.last_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-label text-muted">
        「사람」 은 브라우저 하나입니다(같은 사람이 다른 기기 · 브라우저로 하면
        따로 셉니다). 「-」 는 그 값이 아직 없다는 뜻, 「0」 은 0번입니다. 반응
        속도는 서버 확인을 넣은 뒤(11/27 오후)의 판부터 남습니다.
      </p>
    </div>
  );
}
