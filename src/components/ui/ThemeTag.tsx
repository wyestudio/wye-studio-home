import { isDatingTheme, getThemeTag } from "@/lib/theme";

const sizeClasses = {
  sm: "px-2.5 py-1 text-xs",
  lg: "px-4 py-1.5 text-base font-bold",
} as const;

export function ThemeTag({ themeLabel, size = "sm" }: { themeLabel: string; size?: keyof typeof sizeClasses }) {
  const isDating = isDatingTheme(themeLabel);
  const accentColor = isDating ? "#ff5ec4" : "#3dffb0";

  return (
    <div
      className={`w-fit rounded-full border font-semibold ${sizeClasses[size]}`}
      style={{
        borderColor: accentColor,
        color: accentColor,
        "--hud-accent": accentColor,
      } as React.CSSProperties & { "--hud-accent": string }}
    >
      {getThemeTag(themeLabel)}
    </div>
  );
}
