export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full bg-brand shadow-[0_0_10px_0_var(--glow)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
