/**
 * 회차 선택 블록 안에 가로로 길게 깔리는 얼리버드 배너.
 *
 * 네 가지를 담되 **나열하지 않는다** — 읽는 순서를 왼쪽에서 오른쪽으로 한 번에 잡는다:
 *   왼쪽  제목(무슨 행사인가) → 본문(어떻게 받나)
 *   오른쪽 할인폭(얼마나 싸지나) → 단서(쿠폰도 같이 되나)
 *
 * 왼쪽은 '읽는 글', 오른쪽은 '보는 숫자' 다. 네 줄을 세로로 쌓으면 어느 것도
 * 눈에 먼저 들어오지 않아서, 할인폭만 따로 떼어 오른쪽에 알약으로 세웠다.
 * 좁은 화면에서는 가로 배치가 무너지므로 제목과 할인폭을 한 줄에 묶는다.
 */
export function EarlyBirdBanner({
  title,
  body,
  highlight,
  note,
  accent,
}: {
  title: string;
  body: string | null;
  /** '최대 19% OFF'. 없으면 오른쪽 알약을 그리지 않는다. */
  highlight: string | null;
  /** '보유 쿠폰 중복 적용 가능' */
  note: string | null;
  accent: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border px-4 py-3.5 sm:px-5 sm:py-4"
      style={{
        borderColor: `${accent}59`,
        // 왼쪽에서 오른쪽으로 옅어지는 바탕. 제목이 있는 쪽이 조금 더 진하다.
        backgroundImage: `linear-gradient(100deg, ${accent}24, ${accent}0d 55%, transparent)`,
      }}
    >
      {/* 왼쪽 끝 세로 바. 공지가 아니라 '행사' 라는 표시다. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
      />

      <div className="flex flex-col gap-2.5 pl-2.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          {/* 좁은 화면: 제목과 할인폭을 한 줄에. 넓은 화면에서는 할인폭이 오른쪽으로 빠진다. */}
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-sm font-extrabold tracking-tight sm:text-base lg:text-lg"
              style={{ color: accent }}
            >
              <span aria-hidden="true">🚀</span> {title}
            </p>
            {highlight && (
              <span
                className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold sm:hidden"
                style={{ backgroundColor: accent, color: "#0a0a12" }}
              >
                {highlight}
              </span>
            )}
          </div>

          {body && (
            <p className="mt-1 text-xs leading-relaxed text-white/85 sm:text-sm">{body}</p>
          )}
        </div>

        {/* 넓은 화면 전용 오른쪽 칸 — 할인폭을 크게, 그 아래 단서를 작게. */}
        {(highlight || note) && (
          <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
            {highlight && (
              <span
                className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-extrabold lg:text-base"
                style={{ backgroundColor: accent, color: "#0a0a12" }}
              >
                {highlight}
              </span>
            )}
            {note && (
              <span className="whitespace-nowrap text-micro text-white/70">{note}</span>
            )}
          </div>
        )}

        {/* 좁은 화면에서는 단서가 아래로 내려간다. 위 알약과 중복되지 않게 갈라 둔다. */}
        {note && (
          <p className="text-micro text-white/70 sm:hidden">{note}</p>
        )}
      </div>
    </div>
  );
}
