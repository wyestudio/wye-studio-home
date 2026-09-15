/**
 * 테마 상세 상단의 핵심 정보 — 난이도 · 소요시간 · 장르.
 *
 * 방탈출 손님이 테마를 고를 때 제일 먼저 보는 셋이다. 예전에는 제목 아래
 * 작은 회색 글씨 한 줄(🔒🔒🔒🔒 난이도 4/5 · ⏱ 3시간)이라 그냥 지나쳤다.
 * 방탈출 사이트들이 공통으로 쓰는 '스펙 요약' 처럼 크게 세운다.
 *
 * 난이도는 자물쇠, 소요시간은 '180분' 하나만 크게 둔다. 보조 표기(4 / 5, 3시간)는
 * 가로가 넉넉한 데스크톱(lg)에서만 옆에 작게 붙인다 — 모바일은 포스터 옆 칸이
 * 좁아 두 줄로 밀리고, 같은 정보를 두 번 읽게 된다.
 *
 * 0 은 '미정'(아직 만들지 않은 테마)이다. 해당 칸을 통째로 감춘다 —
 * "난이도 0/5 · 0분" 은 고장으로 읽힌다.
 */
export function ThemeSpecs({
  difficulty,
  durationMinutes,
  genres,
  accent,
}: {
  difficulty: number;
  durationMinutes: number;
  genres: string[];
  accent: string;
}) {
  const showDifficulty = difficulty > 0;
  const showDuration = durationMinutes > 0;
  if (!showDifficulty && !showDuration && genres.length === 0) return null;

  return (
    <dl className="grid gap-2 sm:gap-3 md:grid-cols-2">
      {showDifficulty && (
        <SpecTile label="난이도">
          <SpecValue>
            <LockRow rating={difficulty} accent={accent} />
            <span className="hidden text-sm font-bold text-muted lg:inline">{difficulty} / 5</span>
          </SpecValue>
        </SpecTile>
      )}
      {showDuration && (
        <SpecTile label="소요시간">
          <SpecValue>
            <span className="flex items-baseline gap-0.5">
              <span className="text-[1.75rem] font-extrabold leading-none sm:text-4xl">
                {durationMinutes}
              </span>
              <span className="text-sm font-bold text-muted sm:text-base">분</span>
            </span>
            <span className="hidden text-sm font-bold text-muted lg:inline">
              {hoursLabel(durationMinutes)}
            </span>
          </SpecValue>
        </SpecTile>
      )}

      {/* 장르도 같은 칸 모양에 소제목을 단다. 태그 개수가 들쭉날쭉해 높이는 고정하지 않는다. */}
      {genres.length > 0 && (
        <SpecTile label="장르" className="md:col-span-2">
          <ul className="flex flex-wrap gap-1.5 sm:gap-2">
            {genres.map((g) => (
              <li
                key={g}
                className="rounded-full border px-2.5 py-1 text-xs font-bold sm:px-3.5 sm:py-1.5 sm:text-base"
                style={{ color: accent, borderColor: `${accent}59`, backgroundColor: `${accent}14` }}
              >
                #{g}
              </li>
            ))}
          </ul>
        </SpecTile>
      )}
    </dl>
  );
}

/** 칸 하나. 소제목(dt) + 내용(dd). */
function SpecTile({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-5 sm:py-4 ${className}`}
    >
      <dt className="mb-1.5 text-xs font-bold text-muted sm:mb-2 sm:text-sm">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** 난이도·소요시간 값 줄. 높이를 고정해 두 칸(자물쇠 / 숫자)의 아래끝이 한 선에 선다. */
function SpecValue({ children }: { children: React.ReactNode }) {
  return <div className="flex h-8 items-center gap-3 sm:h-10">{children}</div>;
}

function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 자물쇠 5개. 이모지(🔒)는 기기마다 모양·색이 달라 강조색을 입힐 수 없어서 SVG 로 그린다.
 *
 * ⚠️ 크기는 lg 에서만 키운다. md(태블릿)는 두 칸이 나란히 서는데 칸 폭이 좁아
 *    큰 자물쇠 5개가 넘친다.
 */
function LockRow({ rating, accent, max = 5 }: { rating: number; accent: string; max?: number }) {
  return (
    <span className="flex items-center gap-1 lg:gap-1.5" role="img" aria-label={`난이도 ${rating} / ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < rating;
        return (
          <svg
            key={i}
            viewBox="0 0 16 16"
            aria-hidden
            className="h-5 w-5 lg:h-7 lg:w-7"
            style={{ color: on ? accent : "rgba(255,255,255,0.22)" }}
          >
            <path
              d="M4.75 7V5.25a3.25 3.25 0 0 1 6.5 0V7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <rect x="2.75" y="7" width="10.5" height="7.5" rx="1.75" fill="currentColor" />
          </svg>
        );
      })}
    </span>
  );
}
