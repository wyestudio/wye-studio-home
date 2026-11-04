import Link from "next/link";

/**
 * 「방문 분석」 과 「페이지 보고서」 가 같이 쓰는 기간 계산과 화면 부품.
 * 숫자는 큰 칸(Kpi), 비교는 막대(Bar), 칸마다 같은 테두리(Panel) — 두 화면이 같은 모양으로 읽히게.
 */

export const PERIODS = [
  { key: "today", label: "오늘" },
  { key: "yesterday", label: "어제" },
  { key: "7", label: "7일" },
  { key: "30", label: "30일" },
] as const;

export const DAY_MS = 86400_000;
export const KST_MS = 9 * 3600_000;

/** 현재 시각(ms). 렌더 함수 밖으로 빼 purity 규칙을 지킨다(대시보드와 같은 방식). */
export function getNowMs(): number {
  return Date.now();
}

/** 한국 시간 그날 0시(UTC ms) */
export function kstMidnight(ms: number): number {
  const d = new Date(ms + KST_MS).toISOString().slice(0, 10);
  return Date.parse(`${d}T00:00:00+09:00`);
}

/** 기간 → [시작, 끝) 과 비교할 바로 앞 같은 길이 기간 */
export function windowOf(period: string, nowMs: number) {
  const today = kstMidnight(nowMs);
  if (period === "yesterday") return { from: today - DAY_MS, to: today, prevFrom: today - 2 * DAY_MS, compare: "그 전날보다" };
  if (period === "7" || period === "30") {
    const len = Number(period) * DAY_MS;
    return { from: nowMs - len, to: nowMs, prevFrom: nowMs - 2 * len, compare: `그 전 ${period}일보다` };
  }
  // 오늘: 0시부터 지금까지 — 어제 같은 시각까지와 비교한다
  return { from: today, to: nowMs, prevFrom: today - DAY_MS, prevTo: nowMs - DAY_MS, compare: "어제 이맘때보다" };
}

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function duration(secs: number): string {
  if (!secs) return "-";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m ? `${m}분 ${s}초` : `${s}초`;
}

export function Section({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    // scroll-mt: 목차로 건너뛸 때 위에 고정된 사이트 머리(72px) · 어드민 메뉴(120px, 컴퓨터만)에 제목이 가리지 않게
    <section id={id} className="mb-8 scroll-mt-24 md:scroll-mt-52">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold">{title}</h2>
        {more && (
          <Link href={more.href} className="shrink-0 text-body-sm text-glow hover:underline">
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Panel({ title, className = "", children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    // min-w-0: 그리드 칸이 내용(막대 · 표) 폭만큼 버티면 휴대폰에서 가로로 넘친다
    <div className={`min-w-0 rounded-xl border border-border p-4 md:p-5 ${className}`}>
      {title && <h3 className="mb-3 text-body font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  delta,
  deltaLabel,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  delta?: number | null;
  deltaLabel?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-4">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-h1 font-semibold tabular-nums">
          {value}
          {unit && <span className="ml-0.5 text-body font-normal text-muted">{unit}</span>}
        </span>
        {delta != null && (
          <span
            className={`text-body-sm font-semibold tabular-nums ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-muted"}`}
          >
            {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
            <span className="ml-1 font-normal text-muted">{deltaLabel}</span>
          </span>
        )}
      </p>
      <p className={`mt-1 text-body-sm ${warn ? "text-amber-400" : "text-muted"}`}>{sub}</p>
    </div>
  );
}

export function Bar({ ratio, hot }: { ratio: number; hot?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-fill">
      <div
        className={`h-full rounded-full ${hot ? "bg-amber-400" : "bg-glow"}`}
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
      />
    </div>
  );
}

export function Ranked({
  rows,
  unit,
}: {
  rows: { key: string; label: string; n: number; extra?: string; href?: string }[];
  unit: string;
}) {
  if (rows.length === 0) return <Empty />;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
            {r.href ? (
              <Link href={r.href} className="min-w-0 truncate text-glow hover:underline">
                {r.label}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{r.label}</span>
            )}
            <span className="shrink-0 tabular-nums">
              <strong>
                {r.n}
                {unit}
              </strong>
              {r.extra && <span className="ml-1.5 text-muted">{r.extra}</span>}
            </span>
          </div>
          <Bar ratio={r.n / max} />
        </li>
      ))}
    </ol>
  );
}

export function Empty() {
  return <p className="py-4 text-center text-body-sm text-muted">아직 기록이 없습니다.</p>;
}

export function Guide({ href, title, desc, external }: { href: string; title: string; desc: string; external?: boolean }) {
  const cls = "block rounded-xl border border-border px-4 py-3 hover:bg-fill-subtle";
  const inner = (
    <>
      <p className="text-body-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-body-sm text-muted">{desc}</p>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
