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
 * 이달의 랭킹.
 *
 * 모드 선택 창(ModeBox)과 같은 **도트 게임 언어**로 그린다 — 갈무리 글꼴, 깎지 않은
 * 모서리, 단단한 그림자. 게임이 끝나고 뜨는 순위표처럼 읽히게 한다(2026-10-18).
 *
 * ⚠️ 팀명만 기본 글꼴이다. 손님이 지은 이름이라 도트 글꼴에 없는 글자가 섞이면
 *    한 줄 안에서 글꼴이 갈린다.
 * ⚠️ 기록이 없거나 teaser 가 켜져 있으면 '???' 줄로 자리만 보여준다. 지어낸 팀명을
 *    채워 넣지 않는다 — 진짜 순위처럼 읽힌다.
 */
export function RankingBlock({
  block,
  rankings,
  accent,
  month,
}: {
  block: RankingBlockData;
  rankings: ThemeRanking[];
  accent: string;
  /** 'YYYY-MM' — 머리에 찍는 달. */
  month: string;
}) {
  const bySize = block.layout === "by_size";
  const teaser = Boolean(block.teaser);
  const monthLabel = month.replace("-", ".");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="border border-line bg-fill-subtle shadow-[4px_4px_0_var(--color-line-subtle)]">
        {/* 창 머리 — 게임 창의 타이틀바. */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <span className="font-galmuri text-micro tracking-[0.12em] text-muted">
            MONTHLY RANKING · {monthLabel}
          </span>
          <span aria-hidden className="font-galmuri text-micro tracking-[0.2em]" style={{ color: accent }}>
            ◆ ◆
          </span>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-5">
          {block.criteria && (
            <p className="mb-4 font-galmuri text-micro tracking-[0.04em] text-muted">
              ▶ {block.criteria}
            </p>
          )}

          {teaser ? (
            <Teaser accent={accent} bySize={bySize} />
          ) : bySize ? (
            <div className="flex flex-col gap-5">
              {SIZE_GROUPS.map((g) => (
                <div key={g.size}>
                  <p className="mb-2 font-galmuri text-label" style={{ color: accent }}>
                    {g.label}
                  </p>
                  <RankTable
                    // 노말 랭킹은 노힌트 기준이다 — 힌트를 쓴 기록은 싣지 않는다.
                    rows={sortNormal(rankings.filter((r) => r.group_size === g.size && r.hint_free))}
                    accent={accent}
                    showTime
                  />
                </div>
              ))}
            </div>
          ) : (
            <RankTable rows={sortParty(rankings)} accent={accent} showTime={false} />
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

/** 순위표 머리. 오픈 전 화면에서도 무엇이 기록되는지 알려 주려고 같이 쓴다. */
function HeaderRow({ showTime }: { showTime: boolean }) {
  return (
    <div
      role="row"
      className={`grid ${showTime ? COLS_TIME : COLS} items-center gap-x-2 border-b border-line pb-2 font-galmuri text-micro text-muted`}
    >
      <span role="columnheader">#</span>
      <span role="columnheader">TEAM</span>
      {showTime && (
        <span role="columnheader" className="text-right">
          TIME
        </span>
      )}
      <span role="columnheader" className="text-right">
        PT
      </span>
      <span role="columnheader" className="text-right">
        RANK
      </span>
    </div>
  );
}

function RankTable({
  rows,
  accent,
  showTime,
}: {
  rows: ThemeRanking[];
  accent: string;
  showTime: boolean;
}) {
  const cols = showTime ? COLS_TIME : COLS;

  if (rows.length === 0) {
    return (
      <p className="border border-dashed border-line px-3 py-4 text-center text-body-sm text-muted">
        이달 기록을 모으는 중입니다.
      </p>
    );
  }

  return (
    <div role="table" aria-label="랭킹" className="text-body">
      <HeaderRow showTime={showTime} />
      {rows.map((r, i) => (
        <div
          role="row"
          key={r.id}
          className={`grid ${cols} items-center gap-x-2 border-b border-line-subtle py-2.5 last:border-b-0`}
        >
          <span role="cell" className="font-galmuri" style={{ color: i < 3 ? accent : undefined }}>
            {i + 1}
          </span>
          <span role="cell" className="truncate font-semibold">
            {r.team_name}
          </span>
          {showTime && (
            <span role="cell" className="text-right font-galmuri tabular-nums text-muted">
              {r.remaining_sec === null ? "-" : mmss(r.remaining_sec)}
            </span>
          )}
          <span role="cell" className="text-right font-galmuri tabular-nums">
            {r.points}
          </span>
          <span role="cell" className="text-right">
            <GradeBadge grade={r.grade} accent={accent} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** 등급. S 계열만 강조색 — 위 등급이 한눈에 튀게. */
function GradeBadge({ grade, accent }: { grade: RankingGrade; accent: string }) {
  const top = grade.startsWith("S");
  return (
    <span
      className={`font-galmuri text-label ${top ? "" : grade === "A" || grade === "B" ? "text-foreground" : "text-muted"}`}
      style={top ? { color: accent } : undefined}
    >
      {grade}
    </span>
  );
}

/**
 * 오픈 전 화면. 순위표 머리와 두 줄만 깔고 칸은 '???' 로 채운다 — 무엇이 기록되는지
 * (팀명·시간·포인트·등급) 미리 보여 주면서, 아직 아무도 없다는 걸 숨기지 않는다.
 */
function Teaser({ accent, bySize }: { accent: string; bySize: boolean }) {
  const groups = bySize ? SIZE_GROUPS : [{ size: 0, label: "" }];
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.size}>
          {g.label && (
            <p className="mb-2 font-galmuri text-label" style={{ color: accent }}>
              {g.label}
            </p>
          )}
          <div aria-hidden className="text-body">
            <HeaderRow showTime={bySize} />
            {[1, 2].map((n) => (
              <div
                key={n}
                className={`grid ${bySize ? COLS_TIME : COLS} items-center gap-x-2 border-b border-line-subtle py-2.5 font-galmuri text-muted last:border-b-0`}
              >
                <span style={{ color: accent }}>{n}</span>
                <span>? ? ?</span>
                {bySize && <span className="text-right">--:--</span>}
                <span className="text-right">---</span>
                <span className="text-right">?</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-center font-galmuri text-label motion-safe:animate-pulse" style={{ color: accent }}>
        COMING SOON
      </p>
      <p className="-mt-3 text-center text-body-sm text-muted">
        오픈 후 첫 기록부터 이 자리에 올라갑니다.
      </p>
    </div>
  );
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
