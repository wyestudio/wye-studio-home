"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/adminGuard";
import { redeemGift, restoreGift, setPlayerHidden } from "./actions";
import {
  FunnelBars,
  OutcomeBar,
  Panel,
  PlayerTable,
  RatioCards,
  RoundChart,
  ScoreChart,
  type GameOverview,
} from "./XmasGameCharts";

export type { GameOverview } from "./XmasGameCharts";

export type GiftRow = {
  id: string;
  gift_code: string;
  gift_issued_at: string;
  gift_redeemed_at: string | null;
  score5: number | null;
  nickname: string | null;
};

export type RankRow = {
  id: string;
  player_id: string;
  nickname: string;
  score: number;
  round: number;
  max_combo: number;
  finished_at: string;
  hidden: boolean;
};

/** 난이도 확인(사람 기준) — DB 의 xmas_game_stats(). */
export type GameStats = {
  players: number;
  passed: number;
  passed3: number;
  bonus: number;
  r17: number;
  r20: number;
};

/** 참여 현황(사람 수) — DB 의 xmas_game_funnel(). guests 는 손님만, everyone 은 우리 기기까지. */
type FunnelNumbers = Record<
  | "viewed"
  | "opened"
  | "visited"
  | "via_share"
  | "started"
  | "finished"
  | "passed"
  | "gift"
  | "ranked"
  | "shared"
  | "apply_click"
  | "applied",
  number
>;
export type GameFunnel = { guests: FunnelNumbers; everyone: FunnelNumbers };

/** 참여 현황의 줄 — 위에서 아래로 손님이 지나가는 순서. */
const FUNNEL_ROWS: [keyof FunnelNumbers, string, string][] = [
  ["viewed", "이벤트 블록을 봄", "테마 상세에서 블록이 화면에 들어온 사람"],
  ["opened", "「게임 참여하기」 누름", ""],
  ["visited", "게임 화면에 들어옴", "공유 링크로 바로 온 사람 포함"],
  ["via_share", "공유 링크로 들어옴", "공유한 본인이 눌러 본 것도 포함"],
  ["started", "게임 시작", ""],
  ["finished", "5라운드까지 마침", ""],
  ["passed", "선물 점수 통과", ""],
  ["gift", "정답 맞히고 선물 코드 받음", ""],
  ["ranked", "랭킹 등록", ""],
  ["shared", "「친구에게 공유하기」 누름", ""],
  ["apply_click", "「참여 신청하러 가기」 누름", ""],
  ["applied", "게임한 뒤 신청 완료", "게임을 시작한 뒤에 신청서를 낸 사람"],
];

/** "12명 중 9명" 을 "75%" 로. 아무도 없으면 값을 모른다는 뜻으로 '-' 를 쓴다. */
const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-";

const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const kstDateTime = (iso: string) => KST.format(new Date(iso));

/** 손님 화면과 같은 모양(ABC-DEF)으로 보여 준다. */
const showCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
const normalizeCode = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

const BUTTON =
  "rounded-md border px-3 py-1.5 text-label font-semibold transition-colors disabled:opacity-50";

/** 아래쪽 탭 — 첫눈에 보는 것부터 */
const TABS = [
  { key: "overview", label: "한눈에 보기" },
  { key: "players", label: "참여자" },
  { key: "gifts", label: "선물 코드" },
  { key: "ranks", label: "랭킹" },
] as const;
type Tab = (typeof TABS)[number]["key"];

/**
 * 크리스마스 게임 어드민(2026-11-27 다시 짬 — 대표님: "랭킹에 등록 안 한 사람까지 몇 번 했는지, 라운드별 도달 · 실패를
 * 차트와 표로 첫눈에").
 *   위   요약 숫자 · 선물 코드 확인(현장에서 휴대폰으로 연다 — 늘 맨 위)
 *   탭   한눈에 보기(판 결과 · 라운드별 도달 · 5라운드 점수 분포 · 참여 단계 · 난이도) / 참여자(모든 사람의 시도 · 결과) /
 *        선물 코드 목록 / 랭킹(숨김)
 * 탭은 화면 안에서만 바뀐다(서버를 부르지 않는다).
 */
export function XmasGameAdmin({
  started,
  finished,
  gifts,
  ranks,
  stats,
  funnel,
  overview,
}: {
  started: number;
  finished: number;
  gifts: GiftRow[];
  ranks: RankRow[];
  stats: GameStats | null;
  funnel: GameFunnel | null;
  overview: GameOverview | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, clearQuery = false) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) {
        setError(res.error);
        // 다른 기기에서 먼저 처리했을 수 있다 — 목록을 새로 읽는다
        router.refresh();
        return;
      }
      setNotice(res.message ?? null);
      // 확인 칸에서 처리했으면 칸을 비운다 — 남겨 두면 방금 처리한 코드가 "이미 수령" 으로 빨갛게 뜬다
      if (clearQuery) setQuery("");
      router.refresh();
    });
  }

  const code = normalizeCode(query);
  const match =
    code.length === 6
      ? (gifts.find((g) => g.gift_code === code) ?? null)
      : null;
  const redeemed = gifts.filter((g) => g.gift_redeemed_at).length;

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            [
              "참여한 사람",
              overview ? overview.players.length : "-",
              overview
                ? `랭킹 등록 ${overview.players.filter((p) => p.nickname).length}명`
                : "",
            ],
            ["시작한 판", started, ""],
            [
              "5라운드 완료",
              finished,
              `시작한 판의 ${percent(finished, started)}`,
            ],
            [
              "선물 코드",
              gifts.length,
              `수령 ${redeemed} · 미수령 ${gifts.length - redeemed}`,
            ],
          ] as [string, number | string, string][]
        ).map(([label, value, sub]) => (
          <div
            key={label}
            className="rounded-lg border border-line bg-fill-subtle px-4 py-3"
          >
            <dt className="text-label text-muted">{label}</dt>
            <dd className="mt-1 text-h2 font-extrabold tabular-nums">
              {value}
            </dd>
            {sub && (
              <dd className="mt-0.5 text-label text-muted tabular-nums">
                {sub}
              </dd>
            )}
          </div>
        ))}
      </dl>

      <section className="rounded-xl border border-line bg-fill-subtle p-4 md:p-5">
        <h2 className="text-h3 font-semibold">선물 코드 확인</h2>
        <p className="mt-1 text-body-sm text-muted">
          손님 화면의 코드 6자리를 입력하세요. 줄표와 대소문자는 가리지
          않습니다.
        </p>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
            setNotice(null);
          }}
          placeholder="ABC-DEF"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="선물 코드"
          className="mt-3 w-full max-w-md rounded-lg border border-line bg-background px-3 py-2.5 font-mono text-input uppercase tracking-widest"
        />
        {code.length === 6 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {!match ? (
              <p className="text-body font-semibold text-red-400">
                없는 코드입니다. 방금 받은 코드라면 화면을 새로고침한 뒤 다시
                입력하세요.
              </p>
            ) : match.gift_redeemed_at ? (
              <p className="text-body font-semibold text-red-400">
                이미 수령 처리된 코드입니다 (
                {kstDateTime(match.gift_redeemed_at)}).
              </p>
            ) : (
              <>
                <p className="text-body font-semibold text-confirm">
                  받을 수 있는 코드입니다 ({kstDateTime(match.gift_issued_at)}{" "}
                  발급 · {match.score5 ?? "-"}점).
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => redeemGift(code), true)}
                  className={`${BUTTON} border-glow/50 text-glow hover:bg-glow/10`}
                >
                  선물 지급 처리
                </button>
              </>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-body-sm text-red-400">{error}</p>}
        {notice && <p className="mt-3 text-body-sm text-confirm">{notice}</p>}
      </section>

      <nav
        role="tablist"
        aria-label="크리스마스 게임 보기"
        className="-mb-4 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-body-sm font-semibold transition-colors ${
              tab === t.key
                ? "border-glow text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {overview ? (
            <>
              <Panel
                title="판은 어떻게 끝났나"
                desc={`시작한 판 ${overview.total_runs}개를 결과별로 나눴습니다. 막대에 마우스를 올리면 숫자가 보입니다.`}
              >
                <OutcomeBar overview={overview} />
              </Panel>
              <Panel
                title="라운드별 도달 · 멈춤"
                desc={`막대 하나가 그 라운드까지 닿은 판입니다. 6라운드부터는 이어하기(통과 게이지)이고, 공유하고 재도전은 지금까지 ${overview.retries}번입니다.`}
              >
                <RoundChart overview={overview} />
              </Panel>
              <Panel
                title="5라운드 점수 분포"
                desc="5라운드를 마친 판의 점수입니다. 점선이 선물 기준(35점)입니다."
              >
                <ScoreChart overview={overview} />
              </Panel>
            </>
          ) : (
            <p className="text-body-sm text-red-400">
              판 집계를 불러오지 못했습니다.
            </p>
          )}
          {funnel && (
            <Panel
              title="참여 단계"
              desc="사람(브라우저) 수입니다. 우리 기기는 뺀 숫자가 기준이고, 막대는 가장 많은 줄 대비입니다. 방문 기록은 60일 뒤 지워집니다."
            >
              <FunnelBars
                rows={FUNNEL_ROWS.map(([key, label, note]) => ({
                  label,
                  note,
                  value: funnel.guests[key],
                  extra: funnel.everyone[key],
                }))}
              />
            </Panel>
          )}
          {stats && (
            <Panel
              title="난이도 확인"
              desc="사람 기준입니다. 처음 잡은 목표는 세 판 안에 선물 점수 통과 80%, 이어하기 17라운드 이상 10%, 20라운드 도달 5%입니다."
            >
              <RatioCards
                items={[
                  {
                    label: "세 판 안에 선물 점수 통과",
                    part: stats.passed3,
                    whole: stats.players,
                    who: "5라운드를 마친",
                  },
                  {
                    label: "17라운드 이상",
                    part: stats.r17,
                    whole: stats.bonus,
                    who: "이어하기를 한",
                  },
                  {
                    label: "20라운드 도달",
                    part: stats.r20,
                    whole: stats.bonus,
                    who: "이어하기를 한",
                  },
                ]}
              />
            </Panel>
          )}
        </div>
      )}

      {tab === "players" &&
        (overview ? (
          <Panel
            title="참여자"
            desc="랭킹에 등록하지 않은 사람까지 모두입니다. 위 단추로 골라 보고, 정렬을 바꿀 수 있습니다."
          >
            <PlayerTable players={overview.players} />
          </Panel>
        ) : (
          <p className="text-body-sm text-red-400">
            참여자 집계를 불러오지 못했습니다.
          </p>
        ))}

      {tab === "gifts" && (
        <section>
          <h2 className="mb-3 text-h3 font-semibold">선물 코드 목록</h2>
          {gifts.length === 0 ? (
            <p className="text-body-sm text-muted">
              아직 발급된 코드가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-left text-body-sm">
                <thead className="bg-fill text-label text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">코드</th>
                    <th className="px-3 py-2 font-semibold">발급</th>
                    <th className="px-3 py-2 font-semibold">점수</th>
                    <th className="px-3 py-2 font-semibold">닉네임</th>
                    <th className="px-3 py-2 font-semibold">상태</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {gifts.map((g) => (
                    <tr key={g.id} className="border-t border-line-subtle">
                      <td className="px-3 py-2 font-mono font-semibold tracking-wider">
                        {showCode(g.gift_code)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted">
                        {kstDateTime(g.gift_issued_at)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {g.score5 ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        {g.nickname ?? <span className="text-muted">-</span>}
                      </td>
                      <td className="px-3 py-2">
                        {g.gift_redeemed_at ? (
                          <span className="text-muted">
                            수령 {kstDateTime(g.gift_redeemed_at)}
                          </span>
                        ) : (
                          <span className="text-confirm">미수령</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {g.gift_redeemed_at ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => restoreGift(g.gift_code))}
                            className={`${BUTTON} border-line text-muted hover:bg-fill`}
                          >
                            되돌리기
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => redeemGift(g.gift_code))}
                            className={`${BUTTON} border-glow/50 text-glow hover:bg-glow/10`}
                          >
                            지급 처리
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "ranks" && (
        <section>
          <h2 className="mb-1 text-h3 font-semibold">랭킹</h2>
          <p className="mb-3 text-body-sm text-muted">
            사람마다 가장 좋은 기록 하나입니다(위에서 {ranks.length}명). 숨기면
            그 사람의 기록 전부가 고객 화면 랭킹에서 빠집니다.
          </p>
          {ranks.length === 0 ? (
            <p className="text-body-sm text-muted">
              아직 등록된 기록이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[520px] text-left text-body-sm">
                <thead className="bg-fill text-label text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">닉네임</th>
                    <th className="px-3 py-2 font-semibold">점수</th>
                    <th className="px-3 py-2 font-semibold">라운드</th>
                    <th className="px-3 py-2 font-semibold">최대 콤보</th>
                    <th className="px-3 py-2 font-semibold">기록 시각</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {ranks.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-t border-line-subtle ${r.hidden ? "text-disabled" : ""}`}
                    >
                      <td className="px-3 py-2 tabular-nums text-muted">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {r.nickname}
                        {r.hidden && (
                          <span className="ml-2 text-label font-normal text-muted">
                            숨김
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.score}</td>
                      <td className="px-3 py-2 tabular-nums">{r.round}</td>
                      <td className="px-3 py-2 tabular-nums">{r.max_combo}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">
                        {kstDateTime(r.finished_at)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => setPlayerHidden(r.player_id, !r.hidden))
                          }
                          className={`${BUTTON} border-line text-foreground hover:bg-fill`}
                        >
                          {r.hidden ? "다시 보이기" : "숨김"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
