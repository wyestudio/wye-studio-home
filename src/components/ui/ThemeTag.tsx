import { isDatingTheme } from "@/lib/theme";

function GroupIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="8" cy="7" r="2.5" />
      <circle cx="16" cy="7" r="2.5" />
      <path d="M6 10.5c1.2 0 2.4.4 3.2 1.1 1.6 1.3 1.8 2.9 1.8 4.4v2.5H6v-2.5c0-1.5.2-3.1 1.8-4.4.8-.7 2-1.1 3.2-1.1z" />
      <path d="M18 10.5c-1.2 0-2.4.4-3.2 1.1-1.6 1.3-1.8 2.9-1.8 4.4v2.5h6v-2.5c0-1.5-.2-3.1-1.8-4.4-.8-.7-2-1.1-3.2-1.1z" />
    </svg>
  );
}

function HeartIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function ThemeTag({ sessionType, className = "" }: { sessionType: string; className?: string }) {
  const isDating = isDatingTheme(sessionType);
  const accentColor = isDating ? "#ff5ec4" : "#3dffb0";
  const Icon = isDating ? HeartIcon : GroupIcon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{
        color: accentColor,
      }}
    >
      <Icon className="w-[1em] h-[1em]" />
      <span>{sessionType}</span>
    </div>
  );
}
