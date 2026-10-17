/**
 * 난이도 자물쇠 — 홈 쇼케이스 · 어드민 입력칸 아래 미리보기.
 *
 * 0.5 단위를 쓴다(3.5). **반칸은 왼쪽 절반만 또렷하게** 그려서, 켜진 자물쇠와
 * 꺼진 자물쇠 사이 한 칸으로 읽히게 한다.
 *
 * ⚠️ 반칸은 clipPath 가 아니라 **칸을 겹쳐서** 만든다 — 꺼진 자물쇠를 깔고,
 *    그 위에 폭 절반만 보이는 칸에 켜진 자물쇠를 얹는다. clipPath 는 id 가
 *    필요한데 이 컴포넌트는 서버에서도 그려져서 useId 를 쓸 수 없고, id 를
 *    고정하면 한 화면에 여럿 뜰 때 서로 덮어쓴다.
 */
export function DifficultyLocks({
  rating,
  max = 5,
  className = "",
}: {
  rating: number;
  max?: number;
  className?: string;
}) {
  const capped = Math.min(Math.max(rating, 0), max);
  const full = Math.floor(capped);
  // 3.5 → 3칸 + 반칸. 0.5 미만의 나머지는 버린다(제약상 안 들어오지만 방어).
  const hasHalf = capped - full >= 0.5;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} aria-label={`난이도 ${rating} / ${max}`}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, i) =>
          i < full ? (
            <span key={i}>🔒</span>
          ) : i === full && hasHalf ? (
            <HalfLock key={i} />
          ) : (
            <span key={i} className="opacity-25 grayscale">
              🔒
            </span>
          )
        )}
      </span>
      <span className="text-micro text-muted">난이도 {rating}/{max}</span>
    </div>
  );
}

/** 왼쪽 절반만 켜진 자물쇠. 꺼진 칸 위에 폭 절반짜리 창을 얹는다. */
function HalfLock() {
  return (
    <span className="relative inline-block">
      <span className="opacity-25 grayscale">🔒</span>
      <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
        {/* 안쪽은 원래 폭대로 그려야 한다 — 줄어들면 자물쇠가 납작해진다. */}
        <span className="block whitespace-nowrap">🔒</span>
      </span>
    </span>
  );
}
