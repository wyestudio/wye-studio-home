export function HudPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-glass-border bg-surface/40 px-5 py-6 text-center text-sm text-muted ${className}`}
    >
      {label}
    </div>
  );
}
