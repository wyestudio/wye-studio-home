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
  /**
   * 공개를 고정할 요일 (0=일 … 6=토). null 이면 고정하지 않는다 —
   * 회차마다 자기 날짜의 정확히 N주 전에 열린다.
   */
  open_weekday: number | null;
  /** 그 날 몇 시에 여는가 (KST 'HH:MM') */
  open_time: string;
};

/**
 * 회차 날짜(KST) → 공개 시각(UTC ISO).
 *
 * open_weekday 가 null 이면 회차일에서 그대로 N주를 뺀다 — "3주 전 0시" 규칙이면
 * 10/3(토) 회차는 9/12(토) 0시에, 10/4(일) 회차는 9/13(일) 0시에 열린다.
 *
 * 요일을 지정하면 거기서 **이전(또는 같은 날)의 그 요일로 되감는다.** 예를 들어
 * "3주 전 토요일" 이면 10/4(일)의 3주 전인 9/13(일)이 9/12(토)로 감겨,
 * 그 주말 회차가 토요일 0시에 한꺼번에 열린다.
 *
 * ⚠️ 요일을 지정하면 일부 회차는 N주보다 **더 일찍** 열린다(최대 6일). 고객에게
 *    "3주 전에 열려요" 라고 안내한다면 null 이 말과 맞는다.
 */
export function computeOpensAt(sessionYmd: string, rule: OpenRule): string {
  const base = addDays(sessionYmd, -7 * rule.open_weeks_before);
  if (rule.open_weekday === null) return kstToUtcIso(base, rule.open_time);
  // base 이전(또는 같은 날)의 가장 가까운 open_weekday 로 되감는다.
  const back = (weekdayOf(base) - rule.open_weekday + 7) % 7;
  return kstToUtcIso(addDays(base, -back), rule.open_time);
}

export type ScheduleRule = OpenRule & {
  start_date: string;
  /** 마지막 회차 날짜. 비우면 무기한 반복. */
  end_date?: string | null;
  /** 0=일 … 6=토 */
  weekdays: number[];
  /** 하루 회차 시각 (KST 'HH:MM') */
  times: string[];
};

/** 편성에 따라 from~to (KST 날짜, 양끝 포함) 사이에 회차가 열리는 날짜들. */
export function scheduledDates(rule: ScheduleRule, from: string, to: string): string[] {
  const start = rule.start_date > from ? rule.start_date : from;
  const last = rule.end_date && rule.end_date < to ? rule.end_date : to;
  const dates: string[] = [];
  for (let d = start; d <= last; d = addDays(d, 1)) {
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
