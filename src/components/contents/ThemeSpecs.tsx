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
 * ⚠️ **어느 폭에서나 라벨 왼쪽 · 값 오른쪽**이다. 좁을 때 두 칸으로 쪼개 봤더니
 *    값들이 화면 가운데 어중간하게 떠서 **왼쪽으로 쏠려 보였다**(2026-10-09 지적).
 *    양 끝에 붙이면 포스터·시놉시스 줄과 좌우 끝이 맞는다.
 *
 * ⚠️ 글자 크기는 globals.css 의 역할표를 따른다 — 라벨은 text-label, 값은
 *    text-body, 보조는 text-body-sm. 보기에 커 보인다고 임의로 내리지 말 것.
 *    한 단계씩 내렸다가 모바일에서 너무 작아져 되돌린 적이 있다(2026-10-09).
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
      {showDifficulty && (
        <SpecRow label="난이도">
          <LockRow rating={difficulty} accent={accent} />
        </SpecRow>
      )}
      {showDuration && (
        <SpecRow label="플레이타임">
          <span className="text-body font-semibold tabular-nums">{durationMinutes}분</span>
          <span className="ml-1.5 text-body-sm text-muted">({hoursLabel(durationMinutes)})</span>
        </SpecRow>
      )}

      {genres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          <dt className="sr-only">장르</dt>
          {genres.map((g) => (
            <dd
              key={g}
              className="rounded-full border px-2.5 py-1 text-label font-semibold sm:px-3.5"
              style={{ color: accent, borderColor: `${accent}59`, backgroundColor: `${accent}14` }}
            >
              #{g}
            </dd>
          ))}
        </div>
      )}
    </dl>
  );
}

/** 줄 하나. 라벨은 왼쪽 끝, 값은 오른쪽 끝. */
function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-label text-muted">{label}</dt>
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
 *
 * 난이도는 0.5 단위다(3.5 → 꽉 찬 셋 + 반칸). **반칸은 왼쪽 절반만 칠한다** —
 * 꺼진 색 자물쇠를 깔고 그 위에 폭 절반만 보이는 창으로 켜진 색 자물쇠를 얹는다.
 * 반칸만 꺼진 색을 깔아야 "반" 으로 읽힌다.
 * clipPath 를 쓰지 않는 이유: id 가 필요한데 이 컴포넌트는 서버에서도 그려져
 * useId 를 쓸 수 없고, id 를 고정하면 어드민 미리보기처럼 한 화면에 둘 이상
 * 뜰 때 서로 덮어쓴다.
 */
const LOCK_OFF = "rgba(255,255,255,0.22)";
const LOCK_SIZE = "h-4 w-4";

function LockRow({ rating, accent, max = 5 }: { rating: number; accent: string; max?: number }) {
  const capped = Math.min(Math.max(rating, 0), max);
  const full = Math.floor(capped);
  const hasHalf = capped - full >= 0.5;

  return (
    <span className="flex items-center gap-1" role="img" aria-label={`난이도 ${rating} / ${max}`}>
      {Array.from({ length: full }, (_, i) => (
        <LockGlyph key={i} color={accent} />
      ))}
      {hasHalf && (
        <span className={`relative inline-block ${LOCK_SIZE}`}>
          <LockGlyph color={LOCK_OFF} className="absolute inset-0" />
          <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
            {/* 안쪽은 원래 폭대로 그린다 — 줄이면 자물쇠가 찌그러진다. */}
            <LockGlyph color={accent} />
          </span>
        </span>
      )}
    </span>
  );
}

function LockGlyph({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`block ${LOCK_SIZE} ${className}`} style={{ color }}>
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
  );
}
