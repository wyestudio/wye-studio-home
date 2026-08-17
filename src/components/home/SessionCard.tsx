import Link from "next/link";
import { formatKrw, formatSessionDateTime, formatDuration } from "@/lib/format";
import { isDatingTheme } from "@/lib/theme";
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

export function SessionCard({
  session,
  compact = false,
  dense = false,
  mobileLayout = false,
}: {
  session: Session;
  compact?: boolean;
  // compact와 별개로 "패딩/폰트만 축소"하고 싶을 때(가격 문구는 compact 쪽 그대로 유지) 쓰는 스위치.
  // 홈 스크롤스테이지처럼 뷰포트 높이가 고정된 곳에서 카드 자체 크기를 줄여야 할 때 사용.
  dense?: boolean;
  mobileLayout?: boolean;
}) {
  const colorVariant = isDatingTheme(session.session_type) ? "hud-panel-dating" : "hud-panel-group";
  const duration = session.end_at ? formatDuration(session.start_at, session.end_at) : null;
  const dateTime = formatSessionDateTime(session.start_at);
  const sizeCompact = compact || dense;
  const sm = (cls: string) => (mobileLayout ? "" : cls);

  return (
    <Link
      href={`/sessions/${session.slug}`}
      className={`hud-panel relative flex flex-col ${colorVariant} ${
        sizeCompact ? `gap-3 p-4 ${sm("sm:gap-7 sm:p-7")}` : `gap-6 p-6 ${sm("sm:gap-7 sm:p-7")}`
      }`}
    >
      {/* 태그 */}
      <ThemeTag
        sessionType={session.session_type}
        label={`${session.session_type} 방탈출`}
        className={`font-extrabold leading-tight ${sizeCompact ? `text-xl ${sm("sm:text-3xl")}` : `text-2xl ${sm("sm:text-3xl")}`}`}
      />

      {/* 모바일: 라벨 없이 정보만 나열 (mobileLayout이면 뷰포트와 무관하게 항상) */}
      <div className={mobileLayout ? "" : "sm:hidden"}>
        <p className={sizeCompact ? "text-xs text-foreground" : "text-sm text-foreground"}>
          {dateTime}
          {duration && ` · ${duration}`}
        </p>
      </div>

      {/* 데스크톱: 라벨+값 구조 — mobileLayout이면 항상 숨김 */}
      <div className={mobileLayout ? "hidden" : "hidden sm:flex sm:flex-col gap-1.5"}>
        <SessionCardField label="날짜" value={dateTime} />
        {duration && <SessionCardField label="시간" value={duration} />}
        <SessionCardField label="위치" value={session.venue_area} />
      </div>

      {/* 가격 + 모바일 CTA */}
      <div className={`flex items-end justify-between border-t border-border ${sizeCompact ? `pt-2 ${sm("sm:pt-5")}` : `pt-4 ${sm("sm:pt-5")}`}`}>
        <div className={`flex flex-col items-start ${sizeCompact ? `gap-0.5 ${sm("sm:gap-1")}` : "gap-1"}`}>
          <p className={`text-danger line-through decoration-2 ${sizeCompact ? `text-xs ${sm("sm:text-sm")}` : "text-sm"}`}>{formatKrw(session.original_price_krw)}</p>
          <p className={`font-extrabold ${sizeCompact ? `text-xl ${sm("sm:text-2xl")}` : "text-2xl"}`}>
            {formatKrw(session.price_krw)}
            {!compact && <span className="ml-1 text-xs font-normal text-muted">/ 인당</span>}
          </p>
          <p className="text-xs font-semibold text-muted">8/29 pre-open 한정 할인가</p>
        </div>
        <div className={`${mobileLayout ? "" : "sm:hidden"} text-xs font-semibold`} style={{ color: "var(--hud-accent)" }}>
          자세히 보기 →
        </div>
      </div>
    </Link>
  );
}
