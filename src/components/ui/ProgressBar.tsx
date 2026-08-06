export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-black/10 overflow-hidden">
      <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}
