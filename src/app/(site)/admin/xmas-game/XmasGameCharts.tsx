"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import v from "./XmasGameAdmin.module.css";

/**
 * 크리스마스 게임 어드민의 표 · 그림 — 전체 랭킹 · 사람별 플레이 기록 · 라운드 도달 차트 · 참여 단계(2026-11-27 대표님).
 * 데이터는 DB 의 xmas_game_admin()(supabase/migrations/20261127063948_xmas_game_admin_overview.sql) — 사람마다 판 목록.
 * 색은 XmasGameAdmin.module.css 의 이름표만 쓴다. 숫자 · 글자는 색이 아니라 글자색(text-foreground · muted)으로.
 */

export type RunRow = {
  n: number;
  started_at: string;
  finished_at: string | null;
  round: number;
  score: number;
  score5: number | null;
  max_combo: number;
  answer_tries: number;
  react_ms: number | null;
  retries: number;
  gift: boolean;
  had_gift: boolean;
};

export type PlayerRow = {
  player_id: string;
  nickname: string | null;
  hidden: boolean;
  last_at: string;
  runs: RunRow[];
};

export type GameOverview = { players: PlayerRow[] };

const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
/** "11/27 15:20" */
export const shortKst = (iso: string) => {
  const p = Object.fromEntries(
    KST.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
};

/** 고객 화면 랭킹과 같은 순서 — 점수 높은 순, 같으면 최대 콤보, 같으면 먼저 낸 기록 */
const better = (a: RunRow, b: RunRow) =>
  b.score - a.score ||
  b.max_combo - a.max_combo ||
  (a.finished_at ?? "").localeCompare(b.finished_at ?? "");

/** 그 사람의 가장 좋은 판(5라운드를 마친 판 중) */
export function bestRun(p: PlayerRow): RunRow | null {
  const done = p.runs.filter((r) => r.round >= 5);
  return done.length ? [...done].sort(better)[0] : null;
}

const name = (p: PlayerRow) => p.nickname ?? "미등록";
const shortId = (p: PlayerRow) => p.player_id.slice(0, 6);

/** 표 머리 · 칸 — 이 화면의 표는 다 같은 모양 */
const TH = "px-2.5 py-2 font-semibold";
const TD = "px-2.5 py-2";

/* ── 페이지 넘김 ── */

/**
 * 목록 아래의 페이지 넘김(2026-11-27 대표님 — 운영 데이터가 많아 목록이 길다). 목록은 이미 다 받아 와 있어서
 * 화면 안에서만 넘긴다(서버를 부르지 않는다). 번호는 지금 페이지 둘레만 보여 준다.
 */
export function usePaged<T>(items: T[], size: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  // 목록이 줄어 지금 페이지가 없어졌으면 마지막 페이지로
  const current = Math.min(page, pages - 1);
  return {
    page: current,
    pages,
    setPage,
    slice: items.slice(current * size, current * size + size),
    size,
    total: items.length,
  };
}

export function Pager({
  page,
  pages,
  size,
  total,
  setPage,
}: {
  page: number;
  pages: number;
  size: number;
  total: number;
  setPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const from = Math.max(0, Math.min(page - 2, pages - 5));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => from + i);
  const BTN =
    "min-w-8 rounded-md border px-2.5 py-1 text-label font-semibold tabular-nums transition-colors disabled:opacity-40";
  return (
    <nav
      aria-label="페이지"
      className="mt-3 flex flex-wrap items-center justify-between gap-2"
    >
      <span className="text-label text-muted tabular-nums">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} / {total}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={`${BTN} border-line text-muted hover:bg-fill`}
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          이전
        </button>
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            aria-current={n === page ? "page" : undefined}
            onClick={() => setPage(n)}
            className={`${BTN} ${n === page ? "border-glow bg-glow text-glow-foreground" : "border-line text-muted hover:bg-fill"}`}
          >
            {n + 1}
          </button>
        ))}
        <button
          type="button"
          className={`${BTN} border-line text-muted hover:bg-fill`}
          disabled={page >= pages - 1}
          onClick={() => setPage(page + 1)}
        >
          다음
        </button>
      </span>
    </nav>
  );
}

/* ── 전체 랭킹 ── */

export function RankTable({
  players,
  pending,
  onToggleHidden,
}: {
  players: PlayerRow[];
  pending: boolean;
  onToggleHidden: (playerId: string, hidden: boolean) => void;
}) {
  const rows = useMemo(() => {
    const ranked = players
      .filter((p) => p.nickname)
      .map((p) => ({ p, best: bestRun(p) }))
      .filter((x): x is { p: PlayerRow; best: RunRow } => x.best !== null)
      .sort((a, b) => better(a.best, b.best));
    // 숨긴 사람은 순위를 매기지 않고 맨 아래로 — 고객 화면에서 빠진 순서 그대로 번호를 붙인다
    const shown = ranked
      .filter((x) => !x.p.hidden)
      .map((x, i) => ({ ...x, rank: i + 1 }));
    const hidden = ranked
      .filter((x) => x.p.hidden)
      .map((x) => ({ ...x, rank: null }));
    return [...shown, ...hidden];
  }, [players]);
  // 한 페이지에 10명
  const paged = usePaged(rows, 10);

  if (rows.length === 0)
    return (
      <p className="text-body-sm text-muted">
        아직 랭킹에 오른 기록이 없습니다.
      </p>
    );
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[760px] text-left text-body-sm">
          <thead className="bg-fill text-label text-muted">
            <tr>
              <th className={TH}>순위</th>
              <th className={TH}>닉네임</th>
              <th className={`${TH} text-right`}>점수</th>
              <th className={`${TH} text-right`}>라운드</th>
              <th className={`${TH} text-right`}>최대 콤보</th>
              <th
                className={`${TH} text-right`}
                title="이 기록을 낸 판이 그 사람의 몇 번째 판인가 / 지금까지 시작한 판"
              >
                몇 번째 판
              </th>
              <th
                className={`${TH} text-right`}
                title="이 기록을 낸 판에서 공유하고 재도전한 횟수"
              >
                재도전
              </th>
              <th className={TH}>기록 시각</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {paged.slice.map(({ p, best, rank }) => (
              <tr
                key={p.player_id}
                className={`border-t border-line-subtle tabular-nums ${p.hidden ? "text-disabled" : ""}`}
              >
                <td className={`${TD} font-semibold`}>
                  {rank ?? <span className="text-label font-normal">숨김</span>}
                </td>
                <td className={`${TD} font-semibold`}>{p.nickname}</td>
                <td className={`${TD} text-right font-semibold`}>
                  {best.score}
                </td>
                <td className={`${TD} text-right`}>{best.round}</td>
                <td className={`${TD} text-right`}>{best.max_combo}</td>
                <td className={`${TD} text-right`}>
                  {best.n}번째{" "}
                  <span className="text-muted">/ {p.runs.length}판</span>
                </td>
                <td className={`${TD} text-right`}>
                  {best.retries > 0 ? (
                    `${best.retries}번`
                  ) : (
                    <span className="text-muted">0</span>
                  )}
                </td>
                <td className={`${TD} text-muted`}>
                  {best.finished_at ? shortKst(best.finished_at) : "-"}
                </td>
                <td className={`${TD} text-right`}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onToggleHidden(p.player_id, !p.hidden)}
                    className="rounded-md border border-line px-2.5 py-1 text-label font-semibold text-foreground transition-colors hover:bg-fill disabled:opacity-50"
                  >
                    {p.hidden ? "다시 보이기" : "숨김"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...paged} />
    </>
  );
}

/* ── 라운드 도달 차트 ── */

/** 사람마다 가장 멀리 간 라운드. 5라운드를 한 번도 못 마쳤으면 0 */
const reachOf = (p: PlayerRow) => Math.max(0, ...p.runs.map((r) => r.round));
const reachLabel = (round: number) => (round < 5 ? "5R 전" : `${round}R`);
const REACH_KEYS = [0, ...Array.from({ length: 16 }, (_, i) => i + 5)];
export const reachMatches = (p: PlayerRow, round: number) =>
  round === 0 ? reachOf(p) < 5 : reachOf(p) === round;
export const roundName = reachLabel;

type ReachDatum = {
  round: number;
  label: string;
  사람: number;
  names: string[];
};

/** 막대에 올리면 뜨는 이름 목록 — 많으면 앞의 몇 명만 */
function ReachTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ReachDatum }[];
}) {
  if (!active || !payload?.length) return null;
  const { label, names } = payload[0].payload;
  const SHOW = 12;
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-body-sm shadow-lg">
      <p className="font-semibold">
        {label === "5R 전" ? "5라운드를 못 마침" : `${label}까지`} ·{" "}
        {names.length}명
      </p>
      {names.length > 0 && (
        <p className="mt-1 max-w-[260px] text-label text-muted">
          {names.slice(0, SHOW).join(", ")}
          {names.length > SHOW && ` 외 ${names.length - SHOW}명`}
        </p>
      )}
      {names.length > 0 && (
        <p className="mt-1 text-label text-muted">
          누르면 아래 플레이 기록에 이 사람들만 남습니다
        </p>
      )}
    </div>
  );
}

export function ReachChart({
  players,
  selected,
  onSelect,
}: {
  players: PlayerRow[];
  selected: number | null;
  onSelect: (round: number | null) => void;
}) {
  const data: ReachDatum[] = useMemo(
    () =>
      REACH_KEYS.map((round) => {
        const who = players.filter((p) => reachMatches(p, round));
        return {
          round,
          label: reachLabel(round),
          사람: who.length,
          names: who.map((p) =>
            p.nickname ? p.nickname : `미등록 ${shortId(p)}`,
          ),
        };
      }),
    [players],
  );
  return (
    <div className={v.viz}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        >
          <CartesianGrid vertical={false} stroke="var(--line-subtle)" />
          <XAxis
            dataKey="label"
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
            content={<ReachTooltip />}
            cursor={{ fill: "var(--line-subtle)" }}
          />
          <Bar
            dataKey="사람"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(d: { payload?: ReachDatum }) => {
              const datum = d?.payload;
              if (!datum || datum.사람 === 0) return;
              onSelect(selected === datum.round ? null : datum.round);
            }}
          >
            {data.map((d) => (
              <Cell
                key={d.round}
                fill={
                  selected === null || selected === d.round
                    ? "var(--s1)"
                    : "var(--dim)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 사람별 플레이 기록 ── */

/** 판 하나의 결과 한마디 */
function runResult(r: RunRow): {
  text: string;
  tone: "muted" | "good" | "plain";
} {
  if (r.round < 5) return { text: "5라운드 전에 그만둠", tone: "muted" };
  if ((r.score5 ?? 0) < 35) return { text: "35점 미만", tone: "plain" };
  if (r.gift) return { text: "선물 받음", tone: "good" };
  if (r.had_gift) return { text: "통과 · 이미 받은 사람", tone: "plain" };
  if (r.answer_tries > 0)
    return { text: `통과 · 오답 ${r.answer_tries}번`, tone: "plain" };
  return { text: "통과 · 정답 안 냄", tone: "plain" };
}

export function PlayHistory({ players }: { players: PlayerRow[] }) {
  const [sort, setSort] = useState<"recent" | "runs">("recent");
  const list = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          (sort === "runs" ? b.runs.length - a.runs.length : 0) ||
          b.last_at.localeCompare(a.last_at),
      ),
    [players, sort],
  );

  // 한 페이지에 10명
  const paged = usePaged(list, 10);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-label text-muted">
          정렬
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "runs")}
            className="rounded-md border border-line bg-background px-2 py-1.5 text-label text-foreground"
          >
            <option value="recent">최근 플레이순</option>
            <option value="runs">판 많은 순</option>
          </select>
        </label>
      </div>
      <ul className="flex flex-col gap-2">
        {paged.slice.map((p) => {
          const best = bestRun(p);
          const gift = p.runs.some((r) => r.gift);
          const retries = p.runs.reduce((a, r) => a + r.retries, 0);
          return (
            <li key={p.player_id}>
              <details className="group rounded-lg border border-line bg-background">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-body-sm [&::-webkit-details-marker]:hidden">
                  <span className="min-w-[140px]">
                    <span
                      className={`font-semibold ${p.nickname ? "" : "text-muted"}`}
                    >
                      {name(p)}
                    </span>
                    <span className="ml-2 font-mono text-label text-muted">
                      {shortId(p)}
                    </span>
                    {p.hidden && (
                      <span className="ml-2 text-label text-muted">숨김</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{p.runs.length}</span>판
                  </span>
                  <span className="tabular-nums text-muted">
                    최고 {best ? `${best.round}R · ${best.score}점` : "-"}
                  </span>
                  {gift && <span className="text-confirm">선물 받음</span>}
                  {retries > 0 && (
                    <span className="tabular-nums text-muted">
                      재도전 {retries}번
                    </span>
                  )}
                  <span className="ml-auto tabular-nums text-label text-muted">
                    {shortKst(p.last_at)}
                  </span>
                  <svg
                    aria-hidden
                    viewBox="0 0 12 12"
                    className="h-3 w-3 shrink-0 text-muted transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  </svg>
                </summary>
                <div className="overflow-x-auto border-t border-line-subtle">
                  <table className="w-full min-w-[640px] text-left text-body-sm">
                    <thead className="text-label text-muted">
                      <tr>
                        <th className={TH}>판</th>
                        <th className={TH}>시작</th>
                        <th className={`${TH} text-right`}>라운드</th>
                        <th className={`${TH} text-right`}>점수</th>
                        <th className={`${TH} text-right`}>5R 점수</th>
                        <th className={TH}>결과 · 선물</th>
                        <th className={`${TH} text-right`}>재도전</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.runs.map((r) => {
                        const res = runResult(r);
                        return (
                          <tr
                            key={r.n}
                            className="border-t border-line-subtle tabular-nums"
                          >
                            <td className={`${TD} font-semibold`}>{r.n}번째</td>
                            <td className={`${TD} text-muted`}>
                              {shortKst(r.started_at)}
                            </td>
                            <td className={`${TD} text-right`}>
                              {r.round >= 5 ? (
                                `${r.round}R`
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className={`${TD} text-right`}>
                              {r.round >= 5 ? (
                                r.score
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className={`${TD} text-right`}>
                              {r.score5 ?? (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td
                              className={`${TD} ${res.tone === "good" ? "text-confirm" : res.tone === "muted" ? "text-muted" : ""}`}
                            >
                              {res.text}
                            </td>
                            <td className={`${TD} text-right`}>
                              {r.retries > 0 ? (
                                `${r.retries}번`
                              ) : (
                                <span className="text-muted">0</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      <Pager {...paged} />
      <p className="mt-2 text-label text-muted">
        「사람」 은 브라우저 하나입니다(같은 사람이 다른 기기 · 브라우저로 하면
        따로 셉니다). 줄을 누르면 판마다의 기록이 펼쳐집니다.
      </p>
    </div>
  );
}

/* ── 참여 단계 ── */

/**
 * 가로 막대 목록 — 단계마다 사람 수. 단계가 차례로 줄어드는 깔때기가 아니다(공유 링크로 온 사람은
 * 블록을 안 보고 게임 화면에 온다) — 그래서 비율은 적지 않고, 막대 길이는 가장 많은 줄 대비다.
 */
export function FunnelBars({
  rows,
}: {
  rows: { label: string; note?: string; value: number; extra?: number }[];
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className={`${v.viz} flex flex-col gap-3`}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-body-sm font-semibold">
              {r.label}
              {r.note && (
                <span className="ml-2 text-label font-normal text-muted">
                  {r.note}
                </span>
              )}
            </span>
            <span className="shrink-0 text-body-sm tabular-nums">
              <span className="font-semibold">{r.value}명</span>
              {r.extra !== undefined && (
                <span className="ml-2 text-label text-muted">
                  우리 기기 포함 {r.extra}
                </span>
              )}
            </span>
          </div>
          <div className={v.track}>
            <div
              className={v.fill}
              style={{ width: max > 0 ? `${(r.value / max) * 100}%` : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
