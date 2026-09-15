/**
 * 화살표 아이콘.
 *
 * ⚠️ 글자(‹ › ▾ ˄)로 쓰면 안 된다. 본문 글꼴 SUIT 에 이 글자들이 없어서
 *    기기 기본 글꼴로 대체되는데, 어떤 안드로이드에서는 'E' / 'e' 로 보였다
 *    (2026-09-15 제보). UI 화살표는 글꼴에 기대지 말고 직접 그린다.
 */
export function Chevron({
  dir = "right",
  className = "h-4 w-4",
}: {
  dir?: "left" | "right" | "up" | "down";
  className?: string;
}) {
  const rotate = { right: 0, down: 90, left: 180, up: 270 }[dir];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M9 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
