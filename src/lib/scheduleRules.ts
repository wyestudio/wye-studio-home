/**
 * 회차 편성 · 롤링 오픈 날짜 계산.
 *
 * 서버(Vercel)는 UTC 로 돌기 때문에 Date 의 로컬 메서드를 쓰면 자정 근처에서
 * 하루가 밀린다. 여기서는 날짜를 'YYYY-MM-DD' 문자열로만 다루고, UTC 정오를
 * 기준점으로 써서 시간대 경계를 피한다.
 */

/** 'YYYY-MM-DD' → UTC 정오 Date (요일 계산용 기준점) */
function noonUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = noonUtc(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

/** 요일 (0=일 … 6=토) */
export function weekdayOf(ymd: string): number {
  return noonUtc(ymd).getUTCDay();
}

/** KST 'YYYY-MM-DD' + 'HH:MM' → UTC ISO. 한국은 서머타임이 없어 +09:00 고정. */
export function kstToUtcIso(ymd: string, hhmm: string): string {
  return new Date(`${ymd}T${hhmm}:00+09:00`).toISOString();
}

/** 오늘 (KST 기준 'YYYY-MM-DD') */
export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export type OpenRule = {
  /** 회차일로부터 며칠 전 주에 여는가 (주 단위) */
  open_weeks_before: number;
  /** 그 주의 어느 요일에 여는가 (0=일 … 6=토) */
  open_weekday: number;
  /** 그 날 몇 시에 여는가 (KST 'HH:MM') */
  open_time: string;
};

/**
 * 회차 날짜(KST) → 공개 시각(UTC ISO).
 *
 * "3주 전 토요일 0시" 규칙이면 10/3(토) 회차는 9/12(토) 0시에 열린다.
 * 일요일 회차(10/4)도 3주 전이 9/13(일)이고 거기서 가장 가까운 이전 토요일인
 * 9/12 로 감기므로 토·일이 같이 열린다 — 주말 한 세트가 함께 열리는 게 맞다.
 */
export function computeOpensAt(sessionYmd: string, rule: OpenRule): string {
  const base = addDays(sessionYmd, -7 * rule.open_weeks_before);
  // base 이전(또는 같은 날)의 가장 가까운 open_weekday 로 되감는다.
  const back = (weekdayOf(base) - rule.open_weekday + 7) % 7;
  return kstToUtcIso(addDays(base, -back), rule.open_time);
}

export type ScheduleRule = OpenRule & {
  start_date: string;
  /** 0=일 … 6=토 */
  weekdays: number[];
  /** 하루 회차 시각 (KST 'HH:MM') */
  times: string[];
};

/** 편성에 따라 from~to (KST 날짜, 양끝 포함) 사이에 회차가 열리는 날짜들. */
export function scheduledDates(rule: ScheduleRule, from: string, to: string): string[] {
  const start = rule.start_date > from ? rule.start_date : from;
  const dates: string[] = [];
  for (let d = start; d <= to; d = addDays(d, 1)) {
    if (rule.weekdays.includes(weekdayOf(d))) dates.push(d);
  }
  return dates;
}

/**
 * 앞으로 열릴 회차 중 가장 먼저 공개되는 시점.
 * 어드민에 "다음 공개" 로 보여준다 — 규칙이 의도대로 걸렸는지 눈으로 확인하는 용도.
 */
export function nextOpening(
  rule: ScheduleRule,
  now: Date = new Date()
): { opensAt: string; dates: string[] } | null {
  const nowMs = now.getTime();
  const horizon = addDays(todayKst(now), 7 * (rule.open_weeks_before + 8));
  const upcoming = scheduledDates(rule, todayKst(now), horizon)
    .map((ymd) => ({ ymd, opensAt: computeOpensAt(ymd, rule) }))
    .filter((x) => new Date(x.opensAt).getTime() > nowMs)
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt));

  if (upcoming.length === 0) return null;
  const opensAt = upcoming[0].opensAt;
  return { opensAt, dates: upcoming.filter((x) => x.opensAt === opensAt).map((x) => x.ymd) };
}
