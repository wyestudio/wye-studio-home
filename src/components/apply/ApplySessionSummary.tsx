"use client";

import { formatSessionDateTime, formatDuration } from "@/lib/format";
import { isDatingTheme, getThemeBaseName } from "@/lib/theme";
import { ThemeTag } from "@/components/ui/ThemeTag";

export function ApplySessionSummary({
  themeLabel,
  startAt,
  endAt,
  venueArea,
}: {
  themeLabel: string;
  startAt: string;
  endAt: string | null;
  venueArea: string;
}) {
  const colorVariant = isDatingTheme(themeLabel) ? "hud-panel-dating" : "hud-panel-group";
  const themeBaseName = getThemeBaseName(themeLabel);
  const duration = endAt ? formatDuration(startAt, endAt) : null;
  const dateTime = formatSessionDateTime(startAt);
  const infoLine = [dateTime, duration, venueArea].filter(Boolean).join(" · ");

  return (
    <div className={`hud-panel relative flex flex-col gap-5 p-6 ${colorVariant}`}>
      <div className="flex flex-col gap-2">
        <ThemeTag themeLabel={themeLabel} />
        <h3 className="text-2xl font-extrabold leading-tight" style={{ color: "var(--hud-accent)" }}>
          {themeBaseName}
        </h3>
      </div>
      <p className="text-xs text-muted">{infoLine}</p>
    </div>
  );
}
