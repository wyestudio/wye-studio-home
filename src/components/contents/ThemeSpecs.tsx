/**
 * 테마의 한 줄 정보 — 난이도 · 플레이타임 · 장르.
 *
 * 방탈출 손님이 테마를 고를 때 제일 먼저 보는 셋이다. 예전에는 제목 아래
 * 작은 회색 글씨 한 줄(🔒🔒🔒🔒 난이도 4/5 · ⏱ 3시간)이라 그냥 지나쳤고,
 * 그 다음에는 테두리 있는 큰 칸 세 개였는데 **자리를 너무 먹었다**.
 *
 * 지금은 시안(2026-10-08 baotalchul-mode-design.html)대로 **박스 없이**
 * 윗선 하나 긋고 '라벨 ― 값' 줄로 적는다. 포스터를 크게 쓰려면 이 아래가
 * 가벼워야 한다.
 *
 * 폭에 따라 방향이 다르다.
 *   좁을 때  — 난이도 · 플레이타임을 두 칸으로 나누고 라벨을 값 위에 올린다.
 *   sm 이상  — 한 줄에 하나씩, 라벨은 왼쪽 값은 오른쪽.
 *
 * 0 은 '미정'(아직 만들지 않은 테마)이다. 해당 줄을 통째로 감춘다 —
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
    <dl className="border-t border-line-subtle pt-3.5">
      {(showDifficulty || showDuration) && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-1 sm:gap-y-0">
          {showDifficulty && (
            <SpecRow label="난이도">
              <LockRow rating={difficulty} accent={accent} />
            </SpecRow>
          )}
          {showDuration && (
            <SpecRow label="플레이타임">
              <span className="text-body-sm font-bold tabular-nums">{durationMinutes}분</span>
              <span className="ml-1.5 text-micro text-muted">({hoursLabel(durationMinutes)})</span>
            </SpecRow>
          )}
        </div>
      )}

      {genres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1">
          <dt className="sr-only">장르</dt>
          {genres.map((g) => (
            // ⚠️ 알약(테두리+바탕)이 아니라 **그냥 글씨**다. 알약으로 두면 장르가
            //    네 개일 때 두 줄로 늘어서 포스터 아래가 다시 무거워진다.
            <dd key={g} className="text-micro text-muted">
              #{g}
            </dd>
          ))}
        </div>
      )}
    </dl>
  );
}

/** 줄 하나. 좁을 때는 라벨이 값 위에, sm 이상에서는 라벨 왼쪽 · 값 오른쪽. */
function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sm:flex sm:items-center sm:justify-between sm:gap-3 sm:py-1.5">
      <dt className="mb-1.5 text-micro text-muted sm:mb-0">{label}</dt>
      <dd className="flex min-w-0 items-baseline">{children}</dd>
    </div>
  );
}

/**
 * 분 → "3시간" / "1시간 30분" / "45분".
 * ⚠️ 시간 표기는 **한 곳에서만 만든다.** 화면마다 따로 적으면 같은 회차가
 *    "180분" · "3시간" · "⏱ 3시간" 으로 갈린다(2026-10-05 UX 진단).
 */
export function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 자물쇠. 이모지(🔒)는 기기마다 모양·색이 달라 강조색을 입힐 수 없어서 SVG 로 그린다.
 *
 * ⚠️ **켜진 개수만 그린다**(시안). 예전에는 다섯 개를 그리고 남는 걸 흐리게 뒀는데,
 *    박스를 걷어낸 지금은 줄이 좁아 다섯 개가 값 자리를 다 먹는다.
 *    정확한 수치는 aria-label 이 읽어 준다.
 */
function LockRow({ rating, accent, max = 5 }: { rating: number; accent: string; max?: number }) {
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={`난이도 ${rating} / ${max}`}
      style={{ color: accent }}
    >
      {Array.from({ length: Math.min(rating, max) }, (_, i) => (
        // 시안의 lock-keyhole — 고리 + 몸통 + 열쇠구멍
        <svg key={i} viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
          <path
            d="M4.75 7V5.25a3.25 3.25 0 0 1 6.5 0V7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect x="2.75" y="7" width="10.5" height="7.5" rx="1.75" fill="currentColor" />
          <circle cx="8" cy="10.4" r="1.15" fill="var(--color-background)" />
        </svg>
      ))}
    </span>
  );
}
