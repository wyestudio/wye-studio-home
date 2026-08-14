import Link from "next/link";
import { formatKrw, formatSessionDateTime, formatDuration } from "@/lib/format";
import { isDatingTheme, getThemeBaseName } from "@/lib/theme";
import { ThemeTag } from "@/components/ui/ThemeTag";
import type { Session } from "@/types/domain";

function SessionCardField({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div>
      <p className={`font-medium text-muted ${compact ? "text-[9px]" : "text-[11px]"}`}>{label}</p>
      <p className={`font-semibold text-foreground ${compact ? "text-xs" : "text-sm"}`}>{value}</p>
    </div>
  );
}

export function SessionCard({ session, compact = false }: { session: Session; compact?: boolean }) {
  const colorVariant = isDatingTheme(session.theme_label) ? "hud-panel-dating" : "hud-panel-group";
  const themeBaseName = getThemeBaseName(session.theme_label);
  const duration = session.end_at ? formatDuration(session.start_at, session.end_at) : null;
  const dateTime = formatSessionDateTime(session.start_at);

  return (
    <Link
      href={`/sessions/${session.slug}`}
      className={`hud-panel relative flex flex-col ${colorVariant} ${
        compact ? "gap-3 p-4 sm:gap-4 sm:p-5" : "gap-6 p-6 sm:gap-7 sm:p-7"
      }`}
    >
      {/* 태그 + 타이틀 */}
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"}`}>
        <ThemeTag themeLabel={session.theme_label} />
        <h3 className={`font-extrabold leading-tight ${compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`} style={{ color: "var(--hud-accent)" }}>
          {themeBaseName}
        </h3>
      </div>

      {/* 모바일: 라벨 없이 정보만 나열 */}
      <div className="sm:hidden">
        <p className={compact ? "text-xs text-foreground" : "text-sm text-foreground"}>
          {dateTime}
          {duration && ` · ${duration}`}
        </p>
      </div>

      {/* 데스크톱: 라벨+값 구조, 세로로 촘촘하게 */}
      <div className={`hidden sm:flex sm:flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
        <SessionCardField label="날짜" value={dateTime} compact={compact} />
        {duration && <SessionCardField label="시간" value={duration} compact={compact} />}
        <SessionCardField label="위치" value={session.venue_area} compact={compact} />
      </div>

      {/* 가격 + 모바일 CTA */}
      <div className={`flex items-end justify-between border-t border-border ${compact ? "pt-2 sm:pt-3" : "pt-4 sm:pt-5"}`}>
        <div className={`flex flex-col items-start ${compact ? "gap-0.5" : "gap-1"}`}>
          <p className={`text-danger line-through decoration-2 ${compact ? "text-xs" : "text-sm"}`}>{formatKrw(session.original_price_krw)}</p>
          <p className={`font-extrabold ${compact ? "text-xl" : "text-2xl"}`}>
            {formatKrw(session.price_krw)}
            {!compact && <span className="ml-1 text-xs font-normal text-muted">/ 인당</span>}
          </p>
          <p className={`text-muted ${compact ? "text-[10px]" : "text-[11px]"}`}>8/29 베타 한정 할인가</p>
        </div>
        <div className="sm:hidden text-xs font-semibold" style={{ color: "var(--hud-accent)" }}>
          자세히 보기 →
        </div>
      </div>
    </Link>
  );
}
