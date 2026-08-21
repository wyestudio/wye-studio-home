export function DifficultyLocks({
  rating,
  max = 5,
  className = "",
}: {
  rating: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} aria-label={`난이도 ${rating} / ${max}`}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < rating ? "opacity-100" : "opacity-25 grayscale"}>
            🔒
          </span>
        ))}
      </span>
      <span className="text-xs text-muted">난이도 {rating}/{max}</span>
    </div>
  );
}
