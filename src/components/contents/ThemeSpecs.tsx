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
 * 상세 페이지는 난이도·소요시간(ThemeSpecTiles)과 장르(ThemeGenreTile)를 **따로**
 * 배치한다. 모바일에서 장르만 포스터 아래로 내려가기 때문이다. 어드민 미리보기는
 * 둘을 붙인 ThemeSpecs 를 쓴다.
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
  return (
    <div className="space-y-2 sm:space-y-3">
      <ThemeSpecTiles difficulty={difficulty} durationMinutes={durationMinutes} accent={accent} />
      <ThemeGenreTile genres={genres} accent={accent} />
    </div>
  );
}

/**
 * 난이도 · 소요시간 두 칸.
 *
 * 모바일은 포스터 옆에 위아래로 쌓이고, **포스터 높이만큼 늘어난다**(부모가 stretch
 * 해 주면 h-full + auto-rows-fr 로 두 칸이 반씩 나눠 가진다). 데스크톱은 나란히 두 칸.
 */
export function ThemeSpecTiles({
  difficulty,
  durationMinutes,
  accent,
}: {
  difficulty: number;
  durationMinutes: number;
  accent: string;
}) {
  const showDifficulty = difficulty > 0;
  const showDuration = durationMinutes > 0;
  if (!showDifficulty && !showDuration) return null;

  return (
    <dl className="grid h-full auto-rows-fr gap-2 sm:gap-3 md:h-auto md:auto-rows-auto md:grid-cols-2">
      {showDifficulty && (
        <SpecTile label="난이도">
          <SpecValue>
            {/* 옆 칸의 '180' 과 같은 크기의 보이지 않는 글자. 이 줄의 글자 기준선을 옆 칸과
                똑같이 만들어 '4 / 5' 가 '분' 과 같은 선에 앉게 한다. */}
            <BaselineStrut />
            <LockRow rating={difficulty} accent={accent} />
            <SmallNote>{difficulty} / 5</SmallNote>
          </SpecValue>
        </SpecTile>
      )}
      {showDuration && (
        <SpecTile label="소요시간">
          <SpecValue>
            <span className={BIG_NUMBER}>{durationMinutes}</span>
            <span className="-ml-2.5 text-sm font-bold text-muted sm:text-base">분</span>
            <SmallNote>({hoursLabel(durationMinutes)})</SmallNote>
          </SpecValue>
        </SpecTile>
      )}
    </dl>
  );
}

/** 장르 칸. 난이도·소요시간과 같은 모양에 소제목을 단다. 태그 수가 들쭉날쭉해 높이는 고정하지 않는다. */
export function ThemeGenreTile({ genres, accent }: { genres: string[]; accent: string }) {
  if (genres.length === 0) return null;
  return (
    <dl>
      <SpecTile label="장르">
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
    </dl>
  );
}

/** 칸 하나. 소제목(dt) + 내용(dd). 칸이 늘어나면 내용은 세로 가운데에 선다. */
function SpecTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-5 sm:py-4">
      <dt className="mb-1.5 text-xs font-bold text-muted sm:mb-2 sm:text-sm">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** 소요시간 큰 숫자. 난이도 칸의 BaselineStrut 도 같은 글자 크기를 써야 기준선이 맞는다. */
const BIG_NUMBER = "text-[1.75rem] font-extrabold leading-none sm:text-4xl";

/**
 * 난이도·소요시간 값 줄.
 *
 * 줄 안의 요소를 **글자 기준선(baseline)** 으로 맞춘다. 가운데 정렬(items-center)이었을 땐
 * 작은 글씨 '3시간' 이 큰 숫자의 세로 가운데에 떠서 '분' 보다 위로 붕 떠 보였다.
 * 줄 높이는 고정하고 아래로 붙여(items-end) 두 칸의 기준선 높이가 같게 한다.
 */
function SpecValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-8 items-end sm:h-10">
      <div className="flex items-baseline gap-3">{children}</div>
    </div>
  );
}

/** 폭 0 의 보이지 않는 큰 글자. 난이도 줄에 숫자가 없어도 옆 칸과 같은 기준선을 만든다. */
function BaselineStrut() {
  return (
    <span aria-hidden className={`${BIG_NUMBER} invisible -mr-3 inline-block w-0 overflow-hidden`}>
      0
    </span>
  );
}

/** 데스크톱(lg)에서만 보이는 보조 표기. 모바일은 칸이 좁아 뺀다. */
function SmallNote({ children }: { children: React.ReactNode }) {
  // 칸이 좁아져도 '4 / 5' 가 두 줄로 꺾이지 않게.
  return <span className="hidden whitespace-nowrap text-sm font-bold text-muted lg:inline">{children}</span>;
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
