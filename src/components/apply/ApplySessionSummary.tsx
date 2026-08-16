"use client";

import { formatSessionDateTime, formatDuration } from "@/lib/format";
import { isDatingTheme } from "@/lib/theme";
import { ThemeTag } from "@/components/ui/ThemeTag";

export function ApplySessionSummary({
  themeName,
  sessionType,
  startAt,
  endAt,
  venueArea,
}: {
  themeName: string;
  sessionType: string;
  startAt: string;
  endAt: string | null;
  venueArea: string;
}) {
  const colorVariant = isDatingTheme(sessionType) ? "hud-panel-dating" : "hud-panel-group";
  const duration = endAt ? formatDuration(startAt, endAt) : null;
  const dateTime = formatSessionDateTime(startAt);
  const infoLine = [dateTime, duration, venueArea].filter(Boolean).join(" · ");

  return (
    <div className={`hud-panel relative flex flex-col gap-5 p-6 ${colorVariant}`}>
      <div className="flex items-center gap-3">
        <ThemeTag sessionType={sessionType} className="text-2xl font-extrabold" />
        <h3 className="text-sm font-semibold text-muted leading-tight">
          {themeName}
        </h3>
      </div>
      <p className="text-xs text-muted">{infoLine}</p>
    </div>
  );
}
