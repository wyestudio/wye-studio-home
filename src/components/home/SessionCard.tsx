import Link from "next/link";
import { formatKrw, formatSessionDateTime, formatDuration } from "@/lib/format";
import { isDatingTheme, getThemeBaseName } from "@/lib/theme";
import { ThemeTag } from "@/components/ui/ThemeTag";
import type { Session } from "@/types/domain";

function SessionCardField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function SessionCard({ session }: { session: Session }) {
  const colorVariant = isDatingTheme(session.theme_label) ? "hud-panel-dating" : "hud-panel-group";
  const themeBaseName = getThemeBaseName(session.theme_label);
  const duration = session.end_at ? formatDuration(session.start_at, session.end_at) : null;
  const dateTime = formatSessionDateTime(session.start_at);

  return (
    <Link
      href={`/sessions/${session.slug}`}
      className={`hud-panel relative flex flex-col gap-6 p-6 sm:gap-7 sm:p-7 w-full ${colorVariant}`}
    >
      {/* 태그 + 타이틀 */}
      <div className="flex flex-col gap-2">
        <ThemeTag themeLabel={session.theme_label} />
        <h3 className="text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color: "var(--hud-accent)" }}>
          {themeBaseName}
        </h3>
      </div>

      {/* 모바일: 라벨 없이 정보만 나열 */}
      <div className="sm:hidden">
        <p className="text-sm text-foreground">
          {dateTime}
          {duration && ` · ${duration}`}
        </p>
      </div>

      {/* 데스크톱: 라벨+값 구조, 세로로 촘촘하게 */}
      <div className="hidden sm:flex sm:flex-col gap-1.5">
        <SessionCardField label="날짜" value={dateTime} />
        {duration && <SessionCardField label="시간" value={duration} />}
        <SessionCardField label="위치" value={session.venue_area} />
      </div>

      {/* 가격 + 모바일 CTA */}
      <div className="flex items-end justify-between border-t border-border pt-4 sm:pt-5">
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm text-danger line-through decoration-2">{formatKrw(session.original_price_krw)}</p>
          <p className="text-2xl font-extrabold">
            {formatKrw(session.price_krw)}
            <span className="ml-1 text-xs font-normal text-muted">/ 인당</span>
          </p>
          <p className="text-[11px] text-muted">8/29 베타 한정 할인가</p>
        </div>
        <div className="sm:hidden text-xs font-semibold" style={{ color: "var(--hud-accent)" }}>
          자세히 보기 →
        </div>
      </div>
    </Link>
  );
}
