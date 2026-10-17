/**
 * 호박(잭오랜턴) 그림.
 *
 * 달력에서 할로윈 특별 회차가 열리는 날을 표시한다(BookingCalendar 의 SPECIAL_DAYS).
 *
 * ⚠️ 외부에서 받아온 이미지가 아니라 **직접 그린 SVG** 다. 공개 저장소에서 쓰는
 *    상업 사이트라 출처·라이선스가 걸린 그림을 넣지 않기 위해서다. 같은 이유로
 *    이모지(🎃)도 쓰지 않는다 — 기기마다 모양이 전혀 달라서 어떤 안드로이드에서는
 *    뜻이 안 통한다(화살표 글자가 'E' 로 보인 사고와 같은 종류).
 *
 * 달력 칸에서 16px 로 들어간다. 그 크기에서 뭉개지지 않도록 눈·입을 굵은 면으로
 * 잡고, 골(세로줄)은 실루엣을 호박으로 읽히게 하는 최소한만 남겼다.
 */
export function Pumpkin({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      {/* 꼭지 — 길게 빼면 새싹처럼 보인다. 짧고 굵게 */}
      <path
        d="M12 7V5.4c0-.8.6-1.4 1.5-1.5"
        stroke="#57a23f"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* 몸통 — 세로보다 가로가 길어야 호박이다 */}
      <ellipse cx="12" cy="14.9" rx="9.8" ry="7.3" fill="#ff8b2c" />
      {/* 골 — 지우면 그냥 주황 타원이 된다 */}
      <path
        d="M7.6 10.2c-.9 3.2-.9 6.5 0 9.5M16.4 10.2c.9 3.2.9 6.5 0 9.5"
        stroke="#e06a12"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
      {/* 볼 — 귀여운 인상을 만드는 건 사실상 이 두 점이다 */}
      <circle cx="6.5" cy="16.2" r="1.3" fill="#ff5a2b" opacity="0.5" />
      <circle cx="17.5" cy="16.2" r="1.3" fill="#ff5a2b" opacity="0.5" />
      {/* 눈 — 꼭짓점을 둥글려 험상궂지 않게 했다 */}
      <path
        d="M8.4 12.2h2.4l-1.2 2.2z M13.2 12.2h2.4l-1.2 2.2z"
        fill="#3d1a04"
        stroke="#3d1a04"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* 입 — 가운데 이빨 하나가 웃는 인상을 만든다 */}
      <path
        d="M7.9 16.1c1.2 2.9 7 2.9 8.2 0-1.2 1-2.6 1.5-4.1 1.5s-2.9-.5-4.1-1.5z"
        fill="#3d1a04"
      />
      <path d="M11.1 16.6h1.8l-.9 1.6z" fill="#ff8b2c" />
    </svg>
  );
}
