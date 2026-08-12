import Link from "next/link";
import { formatKrw, formatSessionDate, formatSessionTime, formatDuration } from "@/lib/format";
import { isDatingTheme } from "@/lib/theme";
import type { Session } from "@/types/domain";

// 8/29 베타 한정 할인폭 — 정가는 DB에 따로 저장하지 않고 항상 이 상수만큼
// price_krw(할인가)에 더해서 계산한다. 결제는 무통장입금뿐이라 정가로
// 실제 결제되는 경로는 없음 — 순수 마케팅 표기용.
const BETA_DISCOUNT_KRW = 20000;

function SessionCardField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function SessionCard({ session }: { session: Session }) {
  const originalPriceKrw = session.price_krw + BETA_DISCOUNT_KRW;
  const colorVariant = isDatingTheme(session.theme_label) ? "hud-panel-dating" : "hud-panel-group";

  return (
    <Link
      href={`/sessions/${session.id}`}
      className={`hud-panel hud-clip relative flex flex-col gap-6 p-6 sm:gap-7 sm:p-7 ${colorVariant}`}
    >
      <span aria-hidden className="hud-scanline hud-clip" />

      <h3 className="text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color: "var(--hud-accent)" }}>
        {session.theme_label}
      </h3>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <SessionCardField label="날짜" value={formatSessionDate(session.event_date)} />
        <SessionCardField label="시작 시간" value={`${formatSessionTime(session.start_at)} 시작`} />
        {session.end_at ? (
          <SessionCardField label="플레이타임" value={formatDuration(session.start_at, session.end_at)} />
        ) : null}
        <SessionCardField label="장소" value={session.venue_area} />
      </div>

      <div className="flex flex-col items-start gap-1 border-t border-border pt-4 sm:pt-5">
        <p className="text-sm text-danger line-through decoration-2">{formatKrw(originalPriceKrw)}</p>
        <p className="text-2xl font-extrabold">
          {formatKrw(session.price_krw)}
          <span className="ml-1 text-xs font-normal text-muted">/ 인당</span>
        </p>
        <p className="text-[11px] text-muted">8/29 베타 한정 할인가</p>
      </div>
    </Link>
  );
}
