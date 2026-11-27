"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/adminGuard";
import { redeemGift, restoreGift, setPlayerHidden } from "./actions";
import {
  FunnelBars,
  Pager,
  PlayHistory,
  RankTable,
  ReachChart,
  reachMatches,
  roundName,
  shortKst,
  usePaged,
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

/** 참여 단계(사람 수) — DB 의 xmas_game_funnel(). guests 는 손님만, everyone 은 우리 기기까지. */
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

/** 참여 단계의 줄 — 위에서 아래로 손님이 지나가는 순서. */
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

/** 손님 화면과 같은 모양(ABC-DEF)으로 보여 준다. */
const showCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
const normalizeCode = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

const BUTTON =
  "rounded-md border px-3 py-1.5 text-label font-semibold transition-colors disabled:opacity-50";

/** 위의 바로가기 — 화면 순서 그대로. 선물 코드는 현장에서 바로 쓰게 맨 위(2026-11-27 대표님) */
const SECTIONS = [
  { id: "gifts", label: "선물 코드" },
  { id: "ranking", label: "전체 랭킹" },
  { id: "history", label: "플레이 기록" },
  { id: "funnel", label: "참여 단계" },
];

function Section({
  id,
  title,
  desc,
  children,
}: {
  id: string;
  title: string;
  desc?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border border-line bg-fill-subtle p-4 md:p-5"
    >
      <h2 className="text-h3 font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-body-sm text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * 크리스마스 게임 어드민(2026-11-27 대표님 — "정보가 너무 많고 겹쳐서 헷갈린다. 궁금한 순서대로만"):
 *   선물 코드(현장 지급 처리, 맨 위) → 전체 랭킹 → 플레이 기록(게임 화면에 온 사람 수 · 사람마다 몇 번째 판에 몇 점 · 몇 라운드 · 선물 · 재도전. 라운드 도달 차트를
 *   누르면 그 사람들만) → 참여 단계.
 */
export function XmasGameAdmin({
  gifts,
  funnel,
  overview,
}: {
  gifts: GiftRow[];
  funnel: GameFunnel | null;
  overview: GameOverview;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 라운드 도달 차트에서 고른 막대 — 고르면 플레이 기록에 그 라운드까지 간 사람만 남는다
  const [reach, setReach] = useState<number | null>(null);

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
  // 선물 코드는 위 칸에서 찾아 처리하니 목록은 짧게 — 한 페이지에 5개(2026-11-27 대표님)
  const giftPages = usePaged(gifts, 5);
  const players = overview.players;
  const shown =
    reach === null ? players : players.filter((p) => reachMatches(p, reach));
  const totalRuns = players.reduce((a, p) => a + p.runs.length, 0);
  const totalRetries = players.reduce(
    (a, p) => a + p.runs.reduce((b, r) => b + r.retries, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="바로가기" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-line px-3.5 py-1.5 text-label font-semibold text-muted transition-colors hover:bg-fill hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <Section
        id="gifts"
        title="선물 코드"
        desc={`손님 화면의 코드 6자리를 입력해 지급 처리하세요(줄표 · 대소문자는 가리지 않습니다). 발급 ${gifts.length} · 수령 ${redeemed} · 미수령 ${gifts.length - redeemed}`}
      >
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
          className="w-full max-w-md rounded-lg border border-line bg-background px-3 py-2.5 font-mono text-input uppercase tracking-widest"
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
                이미 수령 처리된 코드입니다 ({shortKst(match.gift_redeemed_at)}
                ).
              </p>
            ) : (
              <>
                <p className="text-body font-semibold text-confirm">
                  받을 수 있는 코드입니다 ({shortKst(match.gift_issued_at)} 발급
                  · {match.score5 ?? "-"}점).
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

        {gifts.length === 0 ? (
          <p className="mt-4 text-body-sm text-muted">
            아직 발급된 코드가 없습니다.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
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
                {giftPages.slice.map((g) => (
                  <tr key={g.id} className="border-t border-line-subtle">
                    <td className="px-3 py-2 font-mono font-semibold tracking-wider">
                      {showCode(g.gift_code)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">
                      {shortKst(g.gift_issued_at)}
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
                          수령 {shortKst(g.gift_redeemed_at)}
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
        <Pager {...giftPages} />
      </Section>

      <Section
        id="ranking"
        title="전체 랭킹"
        desc="닉네임을 등록한 사람마다 가장 좋은 판입니다. 숨긴 사람은 맨 아래에 순위 없이 둡니다."
      >
        <RankTable
          players={players}
          pending={pending}
          onToggleHidden={(id, hidden) =>
            run(() => setPlayerHidden(id, hidden))
          }
        />
      </Section>

      <Section
        id="history"
        title="플레이 기록"
        desc="게임을 시작한 사람마다 몇 번째 판에 몇 점 · 몇 라운드였는지입니다. 랭킹에 등록하지 않은 사람도 모두 있습니다."
      >
        <dl className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              [
                "게임 화면에 온 사람",
                funnel ? funnel.guests.visited : "-",
                "우리 기기 뺌",
              ],
              [
                "게임을 시작한 사람",
                players.length,
                `랭킹 등록 ${players.filter((p) => p.nickname).length}명`,
              ],
              ["시작한 판", totalRuns, ""],
              ["공유하고 재도전", totalRetries, "번"],
            ] as [string, number | string, string][]
          ).map(([label, value, sub]) => (
            <div
              key={label}
              className="rounded-lg border border-line bg-background px-4 py-3"
            >
              <dt className="text-label text-muted">{label}</dt>
              <dd className="mt-1 text-h2 font-extrabold tabular-nums">
                {value}
              </dd>
              {sub && <dd className="mt-0.5 text-label text-muted">{sub}</dd>}
            </div>
          ))}
        </dl>

        <h3 className="text-body font-semibold">
          사람마다 가장 멀리 간 라운드
        </h3>
        <p className="mt-0.5 text-body-sm text-muted">
          막대에 마우스를 올리면 이름이, 누르면 아래 목록에 그 사람들만
          남습니다.
        </p>
        <div className="mt-3">
          <ReachChart players={players} selected={reach} onSelect={setReach} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <h3 className="text-body font-semibold">
            {reach === null
              ? `모든 사람 ${players.length}명`
              : `${roundName(reach) === "5R 전" ? "5라운드를 못 마친" : `${roundName(reach)}까지 간`} 사람 ${shown.length}명`}
          </h3>
          {reach !== null && (
            <button
              type="button"
              onClick={() => setReach(null)}
              className="rounded-full border border-line px-3 py-1 text-label font-semibold text-muted hover:bg-fill"
            >
              전체 보기
            </button>
          )}
        </div>
        <div className="mt-3">
          <PlayHistory key={reach ?? "all"} players={shown} />
        </div>
      </Section>

      {funnel && (
        <Section
          id="funnel"
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
        </Section>
      )}
    </div>
  );
}
