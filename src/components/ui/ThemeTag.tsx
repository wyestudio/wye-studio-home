import { isDatingTheme, getThemeTag } from "@/lib/theme";

export function ThemeTag({ themeLabel }: { themeLabel: string }) {
  const isDating = isDatingTheme(themeLabel);
  const accentColor = isDating ? "var(--hud-accent-dating)" : "var(--hud-accent-group)";

  return (
    <div
      className="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold"
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
