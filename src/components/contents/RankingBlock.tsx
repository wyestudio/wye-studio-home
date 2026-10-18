import Image from "next/image";
import type { CSSProperties } from "react";
import type { RankingGrade, ThemeBlock, ThemeRanking } from "@/types/catalog";

type RankingBlockData = Extract<ThemeBlock, { type: "ranking" }>;

/** 한 판에 보여줄 줄 수. 더 길면 아래 기록이 의미 없이 늘어난다. */
const TOP_N = 5;

/** 노말모드 인원 구분. 4 는 '4인 이상' 이다(theme_rankings.group_size). */
const SIZE_GROUPS: { size: number; label: string }[] = [
  { size: 2, label: "2인" },
  { size: 3, label: "3인" },
  { size: 4, label: "4인 이상" },
];

/**
 * 판 뒤에 깔리는 도트 반짝이. 자리·색·박자는 고정값이다 — 난수로 뿌리면 그릴 때마다
 * 자리가 바뀌고 서버·브라우저 결과가 어긋난다. 색은 현장 앱 엔딩과 같은 세 가지.
 */
const STARS = [
  { x: 4, y: 10, c: "#fff36a", d: 0 },
  { x: 93, y: 7, c: "#b9f1ff", d: 0.7 },
  { x: 88, y: 46, c: "#ff9aca", d: 1.4 },
  { x: 6, y: 58, c: "#b9f1ff", d: 1.9 },
  { x: 96, y: 88, c: "#fff36a", d: 0.4 },
  { x: 3, y: 93, c: "#ff4fa3", d: 1.1 },
];

/**
 * 이달의 랭킹.
 *
 * 현장 앱(BAR-O)의 엔딩 집계표(PLAY RESULT)와 **같은 화면 언어**로 그린다 — 짙은 보라 판,
 * 세로로 눌린 노란 제목, 줄마다 따로 선 카드, 분홍 순위 칩, 도트 반짝이(2026-10-18 대표님).
 * 색과 꾸밈은 globals.css 의 `.baro-rank*` 에 모아 뒀다.
 *
 * ⚠️ 팀명만 기본 글꼴이다. 손님이 지은 이름이라 도트 글꼴에 없는 글자가 섞이면
 *    한 줄 안에서 글꼴이 갈린다.
 * ⚠️ 기록이 없거나 teaser 가 켜져 있으면 '???' 줄로 자리만 보여준다. 지어낸 팀명을
 *    채워 넣지 않는다 — 진짜 순위처럼 읽힌다.
 */
export function RankingBlock({
  block,
  rankings,
  month,
}: {
  block: RankingBlockData;
  rankings: ThemeRanking[];
  /** 현장 앱 팔레트를 그대로 쓰므로 모드 강조색은 쓰지 않는다. 부르는 쪽 모양을 맞추려고 받기만 한다. */
  accent?: string;
  /** 'YYYY-MM' — 머리에 찍는 달. */
  month: string;
}) {
  const bySize = block.layout === "by_size";
  const teaser = Boolean(block.teaser);
  const monthLabel = month.replace("-", ".");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="baro-rank px-4 pb-6 pt-7 sm:px-6">
        {STARS.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="baro-rank-star"
            style={{ left: `${s.x}%`, top: `${s.y}%`, "--c": s.c, animationDelay: `${s.d}s` } as CSSProperties}
          />
        ))}

        <div className="relative text-center">
          <p className="font-galmuri text-label tracking-[0.06em] text-[var(--bo-pink-mid)]">{monthLabel}</p>
          <p className="baro-rank-title mt-1 font-galmuri text-h2">MONTHLY RANKING</p>
          {block.criteria && (
            <p className="mt-2 text-body-sm text-[var(--bo-dim)]">{block.criteria}</p>
          )}
        </div>

        <div className="relative mt-6">
          {teaser ? (
            <Teaser bySize={bySize} />
          ) : bySize ? (
            <div className="flex flex-col gap-6">
              {SIZE_GROUPS.map((g) => (
                <div key={g.size}>
                  <GroupLabel label={g.label} />
                  <RankTable
                    // 노말 랭킹은 노힌트 기준이다 — 힌트를 쓴 기록은 싣지 않는다.
                    rows={sortNormal(rankings.filter((r) => r.group_size === g.size && r.hint_free))}
                    showTime
                  />
                </div>
              ))}
            </div>
          ) : (
            <RankTable rows={sortParty(rankings)} showTime={false} />
          )}
        </div>
      </div>

      {block.note && (
        <p className="mt-4 rounded-lg border border-line bg-fill px-4 py-3 text-body text-muted">
          {block.note}
        </p>
      )}
    </div>
  );
}

/** 파티 — 포인트 높은 순. */
function sortParty(rows: ThemeRanking[]) {
  return [...rows].sort((a, b) => b.points - a.points).slice(0, TOP_N);
}

/** 노말 — 포인트 높은 순, 같으면 남은 시간이 많은 순. */
function sortNormal(rows: ThemeRanking[]) {
  return [...rows]
    .sort((a, b) => b.points - a.points || (b.remaining_sec ?? -1) - (a.remaining_sec ?? -1))
    .slice(0, TOP_N);
}

const COLS_TIME = "grid-cols-[2rem_minmax(0,1fr)_3.5rem_3rem_2.75rem]";
const COLS = "grid-cols-[2rem_minmax(0,1fr)_3.5rem_2.75rem]";

/** 인원 구분 머리 — 현장 엔딩의 단체명 줄과 같은 민트. */
function GroupLabel({ label }: { label: string }) {
  return <p className="mb-2 font-galmuri text-label text-[var(--bo-mint)]">{label}</p>;
}

/** 순위표 머리. 오픈 전 화면에서도 무엇이 기록되는지 알려 주려고 같이 쓴다. */
function HeaderRow({ showTime }: { showTime: boolean }) {
  return (
    <div
      role="row"
      className={`baro-rank-head grid ${showTime ? COLS_TIME : COLS} items-center gap-x-2 px-3 pb-2 font-galmuri text-micro`}
    >
      <span role="columnheader" className="text-center">
        #
      </span>
      <span role="columnheader">팀</span>
      {showTime && (
        <span role="columnheader" className="text-right">
          남은 시간
        </span>
      )}
      <span role="columnheader" className="text-right">
        포인트
      </span>
      <span role="columnheader" className="text-center">
        등급
      </span>
    </div>
  );
}

function RankChip({ n }: { n: number }) {
  return (
    <span className="baro-rank-chip block py-0.5 text-center font-galmuri text-label leading-none">{n}</span>
  );
}

function RankTable({ rows, showTime }: { rows: ThemeRanking[]; showTime: boolean }) {
  const cols = showTime ? COLS_TIME : COLS;

  if (rows.length === 0) {
    return (
      <p className="border-2 border-dashed border-[var(--bo-border)] px-3 py-4 text-center text-body-sm text-[var(--bo-dim)]">
        이달 기록을 모으는 중입니다.
      </p>
    );
  }

  return (
    <div role="table" aria-label="랭킹" className="flex flex-col gap-1.5 text-body">
      <HeaderRow showTime={showTime} />
      {rows.map((r, i) => (
        <div
          role="row"
          key={r.id}
          // 한 줄씩 차례로 켜진다 — 현장 집계표와 같은 박자.
          style={{ animationDelay: `${0.1 + i * 0.12}s` }}
          className={`baro-rank-row grid ${cols} items-center gap-x-2 px-3 py-2`}
        >
          <span role="cell">
            <RankChip n={i + 1} />
          </span>
          <span role="cell" className="truncate font-semibold">
            {r.team_name}
          </span>
          {showTime && (
            <span role="cell" className="text-right font-galmuri tabular-nums text-[var(--bo-sky)]">
              {r.remaining_sec === null ? "-" : mmss(r.remaining_sec)}
            </span>
          )}
          <span role="cell" className="baro-rank-pt text-right font-galmuri text-h3 tabular-nums">
            {r.points}
          </span>
          <span role="cell">
            <GradeBadge grade={r.grade} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 등급 배지 — 현장 앱(BAR-O)의 엔딩 집계표와 **같은 그림**(public/ranking-grade/<등급>.png).
 * 현장에서 받은 배지를 사이트에서도 그대로 알아보게 한다(2026-10-18 대표님).
 *
 * ⚠️ 72px 도트 그림이라 줄일 때 흐려지지 않게 `image-rendering: pixelated` 를 준다.
 * ⚠️ 그림을 갈아 끼울 때는 파일명을 바꾼다(wye-customer-facing — 검색 이미지 캐시).
 */
function GradeBadge({ grade }: { grade: RankingGrade }) {
  return (
    <Image
      src={`/ranking-grade/${grade.toLowerCase()}.png`}
      alt={`${grade} 등급`}
      width={72}
      height={72}
      unoptimized
      className="mx-auto block h-9 w-9 [image-rendering:pixelated]"
    />
  );
}

/**
 * 오픈 전 화면. 순위표 머리와 두 줄만 깔고 칸은 '???' 로 채운다 — 무엇이 기록되는지
 * (팀명·시간·포인트·등급) 미리 보여 주면서, 아직 아무도 없다는 걸 숨기지 않는다.
 */
function Teaser({ bySize }: { bySize: boolean }) {
  const groups = bySize ? SIZE_GROUPS : [{ size: 0, label: "" }];
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.size}>
          {g.label && <GroupLabel label={g.label} />}
          <div aria-hidden className="flex flex-col gap-1.5 text-body">
            <HeaderRow showTime={bySize} />
            {[1, 2].map((n) => (
              <div
                key={n}
                className={`baro-rank-row grid ${bySize ? COLS_TIME : COLS} items-center gap-x-2 px-3 py-2 font-galmuri text-[var(--bo-dim)]`}
              >
                <RankChip n={n} />
                <span>? ? ?</span>
                {bySize && <span className="text-right">--:--</span>}
                <span className="text-right">---</span>
                <span className="text-center">?</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="baro-rank-pt text-center font-galmuri text-label motion-safe:animate-pulse">COMING SOON</p>
      <p className="-mt-4 text-center text-body-sm text-[var(--bo-dim)]">오픈 후 첫 기록부터 이 자리에 올라갑니다.</p>
    </div>
  );
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
