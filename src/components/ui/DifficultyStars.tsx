function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
    >
      <path d="M12 2.5l2.9 6.3 6.85.7-5.15 4.65 1.5 6.75L12 17.6l-6.1 3.3 1.5-6.75L2.25 9.5l6.85-.7z" />
    </svg>
  );
}

export function DifficultyStars({
  rating,
  max = 5,
  className = "",
}: {
  rating: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 text-muted ${className}`} aria-label={`난이도 ${rating} / ${max}`}>
      <span className="flex items-center gap-0.5 text-amber-400">
        {Array.from({ length: max }, (_, i) => (
          <StarIcon key={i} filled={i < rating} className="h-[1em] w-[1em]" />
        ))}
      </span>
      <span className="text-xs text-muted">난이도 {rating}/{max}</span>
    </div>
  );
}
