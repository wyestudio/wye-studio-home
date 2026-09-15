/**
 * 테마 상세 상단의 핵심 정보 — 난이도 · 소요시간 · 장르.
 *
 * 방탈출 손님이 테마를 고를 때 제일 먼저 보는 셋이다. 예전에는 제목 아래
 * 작은 회색 글씨 한 줄(🔒🔒🔒🔒 난이도 4/5 · ⏱ 3시간)이라 그냥 지나쳤다.
 * 방탈출 사이트들이 공통으로 쓰는 '스펙 요약' 처럼 숫자를 크게 세운다.
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
    <div className="space-y-3 sm:space-y-4">
      {(showDifficulty || showDuration) && (
        <dl className="grid gap-2 sm:gap-3 md:grid-cols-2">
          {showDifficulty && (
            <SpecTile label="난이도">
              <p className="flex items-baseline gap-1 leading-none">
                <span className="text-[1.75rem] font-extrabold sm:text-4xl">{difficulty}</span>
                <span className="text-sm font-bold text-muted sm:text-base">/ 5</span>
              </p>
              <LockRow rating={difficulty} accent={accent} />
            </SpecTile>
          )}
          {showDuration && (
            <SpecTile label="소요시간">
              <p className="flex items-baseline gap-1 leading-none">
                <span className="text-[1.75rem] font-extrabold sm:text-4xl">{durationMinutes}</span>
                <span className="text-sm font-bold text-muted sm:text-base">분</span>
              </p>
              {/* 자물쇠 줄과 높이를 맞춰 두 칸의 아래끝이 한 선에 선다.
                  좁은 화면에서는 뺀다 — 포스터 옆 칸이 포스터보다 길어진다. */}
              <p className="mt-2 hidden h-5 items-center text-xs text-muted sm:flex sm:text-sm">
                {hoursLabel(durationMinutes)} 진행
              </p>
            </SpecTile>
          )}
        </dl>
      )}

      {genres.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="장르">
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
      )}
    </div>
  );
}

function SpecTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-5 sm:py-4">
      <dt className="mb-1.5 text-xs font-bold text-muted sm:mb-2 sm:text-sm">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 자물쇠 5개. 이모지(🔒)는 기기마다 모양·색이 달라 강조색을 입힐 수 없어서 SVG 로 그린다.
 */
function LockRow({ rating, accent, max = 5 }: { rating: number; accent: string; max?: number }) {
  return (
    <span className="mt-2 flex h-5 items-center gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => {
        const on = i < rating;
        return (
          <svg
            key={i}
            viewBox="0 0 16 16"
            className="h-4 w-4 sm:h-5 sm:w-5"
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
