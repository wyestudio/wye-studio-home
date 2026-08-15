import { isDatingTheme, getThemeTag } from "@/lib/theme";

function GroupIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-1.657 0-5 .895-5 2.683V19h10v-2.317C14 14.895 10.657 14 9 14zm6-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2c-.666 0-2.03.394-2.5 1.07.166.397.5.878 1 1.2.917.614 2.08.614 2.997 0 .5-.322.834-.803 1-.2.47-.676 1.834-1.07 2.5-1.07z" />
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

export function ThemeTag({ themeLabel, className = "" }: { themeLabel: string; className?: string }) {
  const isDating = isDatingTheme(themeLabel);
  const accentColor = isDating ? "#ff5ec4" : "#3dffb0";
  const tagText = getThemeTag(themeLabel);
  const Icon = isDating ? HeartIcon : GroupIcon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{
        color: accentColor,
      }}
    >
      <Icon className="w-[1em] h-[1em]" />
      <span>{tagText}</span>
    </div>
  );
}
