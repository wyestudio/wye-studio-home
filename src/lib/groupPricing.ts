/**
 * 단체 견적 계산 — 요금표 · 옵션 · 회차 규칙.
 *
 * 화면(/group)과 접수 API 가 **같은 함수**로 계산한다. 화면이 보낸 금액은 믿지
 * 않고 서버가 이 파일로 다시 계산해 저장한다 — 두 곳에 따로 적으면 화면과 접수함의
 * 금액이 갈린다.
 *
 * ⚠️ 이 파일은 `"use client"` 화면이 import 한다. 여기 있는 값은 전부 화면에 그대로
 *    보이는 가격이다. 감출 값을 적지 않는다.
 */

/** 인원 구간. 인덱스가 요금표 열 순서다. */
export const PRICE_BANDS = [
  { min: 6, max: 9, label: "6~9명" },
  { min: 10, max: 14, label: "10~14명" },
  { min: 15, max: 19, label: "15~19명" },
  { min: 20, max: 24, label: "20~24명" },
] as const;

/** 요금표가 있는 인원 상한. 넘으면 '별도 상담' 이다. */
export const PRICED_HEADCOUNT_MAX = 24;
/** 화면에서 고를 수 있는 인원 상한. 25명 이상은 접수만 받고 금액은 상담으로. */
export const QUOTE_HEADCOUNT_MAX = 60;

type RateTable = { weekday: readonly number[]; weekend: readonly number[] };

/**
 * 1인 요금(원). 기간 · 평일/주말 · 인원 구간으로 정해진다.
 *
 * - 11월까지: 오픈 특가(가시안 v2 의 값).
 * - 12월 · 1월: 대표님이 준 표(2026-10-25). 6~9명 주말 49,000원은 표에 '임시 제안' 으로
 *   적혀 있던 값이다 — 확정되면 여기만 고친다.
 * ⚠️ 표에 '12월 평일 37,000원~' 이라는 머리 문구가 있었지만 표 안 최저는 41,000원이라
 *    맞지 않았다. 표 안의 값을 따랐다.
 */
const RATE_PERIODS: readonly { until: string; label: string; rates: RateTable }[] = [
  {
    until: "2026-11-30",
    label: "11월까지 오픈 특가",
    rates: { weekday: [47000, 43000, 41000, 39000], weekend: [49000, 45000, 43000, 41000] },
  },
  {
    until: "2027-01-31",
    label: "12월 · 1월 요금",
    rates: { weekday: [47000, 45000, 43000, 41000], weekend: [49000, 47000, 45000, 43000] },
  },
];

/** 고를 수 있는 마지막 날. 요금표가 끝나는 날과 같다. */
export const QUOTE_LAST_DATE = RATE_PERIODS[RATE_PERIODS.length - 1].until;

/** 주말 = 금·토·일. 주말은 정해진 회차만 연다. */
const WEEKEND_DAYS = [5, 6, 0];
export const WEEKEND_TIMES = ["11:30", "15:30", "19:30"] as const;

/**
 * 평일 시작 시간 — 09:30 ~ 21:30 사이면 몇 분이든 된다(2026-10-26 대표님. 30분 단위로 묶지 않는다).
 * 화면과 접수 API 가 같이 이 함수로 본다.
 */
export const WEEKDAY_TIME_FIRST = "09:30";
export const WEEKDAY_TIME_LAST = "21:30";
export function isWeekdayTime(t: string): boolean {
  // 'HH:MM' 은 글자 순서가 곧 시간 순서라 문자열로 비교해도 된다.
  return HHMM.test(t) && t >= WEEKDAY_TIME_FIRST && t <= WEEKDAY_TIME_LAST;
}
/** 주말에 애프터파티를 이어갈 수 있는 회차(뒤에 다른 회차가 없다). */
export const AFTER_PARTY_WEEKEND_TIME = "19:30";

export const BASE_MINUTES = 180;

/** 옵션 금액은 **단체 1회 기준**이다(인당 아님). */
export const OPTION = {
  icebreaking: { minutes: 30, discount: 50000 },
  character: { price: 10000 },
  afterParty: { hourly: 50000, maxHours: 4 },
  cleanup: { price: 150000 },
} as const;

/** 예약금 비율. 금액 안내용 — 실제 입금액은 운영자가 확정해 안내한다. */
export const DEPOSIT_RATE = 0.3;

export type QuoteOptions = {
  icebreaking: boolean;
  character: boolean;
  afterPartyHours: number;
  cleanup: boolean;
};

export const DEFAULT_OPTIONS: QuoteOptions = {
  icebreaking: true,
  // 돈이 드는 옵션은 비워 둔 채 시작한다 — 미리 체크해 두면 '특정 옵션 사전선택'
  // 다크패턴이다(개정 전자상거래법, 2025-02-14 시행).
  character: false,
  afterPartyHours: 0,
  cleanup: false,
};

/** 'YYYY-MM-DD' → 요일(0=일). 시간대와 무관하게 날짜만 본다. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(date: string): boolean {
  return WEEKEND_DAYS.includes(weekdayOf(date));
}

/** 한국 시간 기준 오늘 'YYYY-MM-DD'. 서버(UTC)와 브라우저가 같은 날을 보게 한다. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' 에 n 일 더하기. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 고를 수 있는 첫날 — 내일. 당일 단체는 준비가 안 된다. */
export function quoteFirstDate(now: Date = new Date()): string {
  return addDays(kstToday(now), 1);
}

export function bandIndex(headcount: number): number | null {
  const i = PRICE_BANDS.findIndex((b) => headcount >= b.min && headcount <= b.max);
  return i < 0 ? null : i;
}

function periodOf(date: string) {
  return RATE_PERIODS.find((p) => date <= p.until) ?? null;
}

/** 1인 요금. 요금표 밖(25명 이상 · 표가 끝난 날짜)이면 null. */
export function unitPrice(date: string, headcount: number): number | null {
  const band = bandIndex(headcount);
  const period = periodOf(date);
  if (band == null || !period) return null;
  return (isWeekend(date) ? period.rates.weekend : period.rates.weekday)[band];
}

export function rateLabel(date: string): string | null {
  return periodOf(date)?.label ?? null;
}

/**
 * 오늘 이후 고를 수 있는 날 중 가장 낮은 1인 요금. 안내 페이지의 '부터' 표시에 쓴다.
 * 기간이 끝난 요금표는 빼야 한다 — 지난 특가를 '부터' 로 내걸면 거짓이 된다.
 */
export function unitPriceRange(now: Date = new Date()): { min: number; max: number } | null {
  const today = kstToday(now);
  const live = RATE_PERIODS.filter((p) => p.until >= today);
  const all = live.flatMap((p) => [...p.rates.weekday, ...p.rates.weekend]);
  return all.length ? { min: Math.min(...all), max: Math.max(...all) } : null;
}

/**
 * 인원 구간 버튼에 적을 1인 요금. 날짜를 골랐으면 그날 요금, 아니면 앞으로 고를 수 있는
 * 날 중 가장 낮은 값(from = true → '~' 를 붙인다).
 * 구간끼리 한 번씩 눌러 비교하게 하려는 값이다 — 9명이 비싸서 망설이던 모임이 10명을
 * 맞춰 오게 하는 것이 목적(2026-10-25 대표님).
 */
export function bandUnit(band: number, date: string | null, now: Date = new Date()): { price: number | null; from: boolean } {
  if (date) return { price: unitPrice(date, PRICE_BANDS[band].min), from: false };
  const today = kstToday(now);
  const live = RATE_PERIODS.filter((p) => p.until >= today);
  const all = live.flatMap((p) => [p.rates.weekday[band], p.rates.weekend[band]]);
  return { price: all.length ? Math.min(...all) : null, from: true };
}

/** 같은 시기·같은 인원 구간의 평일/주말 1인 요금. 달력 아래 비교 한 줄에 쓴다. */
export function dayTypeRates(date: string, headcount: number): { weekday: number; weekend: number } | null {
  const band = bandIndex(headcount);
  const period = periodOf(date);
  if (band == null || !period) return null;
  return { weekday: period.rates.weekday[band], weekend: period.rates.weekend[band] };
}

/** 이 날짜·회차에 애프터파티를 이어갈 수 있나. 평일은 시작 시간과 상관없이 된다. */
export function canAfterParty(date: string, time: string): boolean {
  return !isWeekend(date) || time === AFTER_PARTY_WEEKEND_TIME;
}

/** 옵션을 날짜·회차 규칙에 맞게 고친다. 화면에서 회차를 바꾸면 애프터파티가 풀릴 수 있다. */
export function normalizeOptions(o: QuoteOptions, date: string | null, time: string | null): QuoteOptions {
  const allowParty = date && time ? canAfterParty(date, time) : true;
  const hours = allowParty
    ? Math.max(0, Math.min(OPTION.afterParty.maxHours, Math.trunc(o.afterPartyHours || 0)))
    : 0;
  return {
    icebreaking: !!o.icebreaking,
    character: !!o.character,
    afterPartyHours: hours,
    cleanup: hours > 0 && !!o.cleanup,
  };
}

export type QuoteLine = { label: string; detail?: string; amount: number };

export type Quote = {
  unit: number | null;
  /** 요금표가 없어 기본 요금을 못 매긴 이유. 금액이 있으면 null. */
  unpricedReason: string | null;
  lines: QuoteLine[];
  /** 옵션만 더한 금액(기본 요금 제외). 기본 요금을 못 매겨도 보여줄 수 있다. */
  optionsTotal: number;
  total: number | null;
  perPerson: number | null;
  deposit: number | null;
  minutes: number;
};

export function calcQuote(input: {
  headcount: number;
  date: string | null;
  time: string | null;
  options: QuoteOptions;
}): Quote {
  const o = normalizeOptions(input.options, input.date, input.time);
  const unit = input.date ? unitPrice(input.date, input.headcount) : null;

  const lines: QuoteLine[] = [];
  if (unit != null) {
    lines.push({
      label: "기본 프로그램",
      detail: `${unit.toLocaleString("ko-KR")}원 × ${input.headcount}명`,
      amount: unit * input.headcount,
    });
  }
  if (!o.icebreaking) {
    lines.push({ label: "레크리에이션 빼기", detail: "30분 단축", amount: -OPTION.icebreaking.discount });
  }
  if (o.character) lines.push({ label: "캐릭터 꾸미기", amount: OPTION.character.price });
  if (o.afterPartyHours > 0) {
    lines.push({
      label: "애프터파티",
      detail: `${o.afterPartyHours}시간`,
      amount: o.afterPartyHours * OPTION.afterParty.hourly,
    });
  }
  if (o.cleanup) lines.push({ label: "뒷정리 서비스", amount: OPTION.cleanup.price });

  const optionsTotal = lines.filter((l) => l.label !== "기본 프로그램").reduce((s, l) => s + l.amount, 0);
  const total = unit == null ? null : unit * input.headcount + optionsTotal;

  let unpricedReason: string | null = null;
  if (unit == null) {
    if (input.headcount > PRICED_HEADCOUNT_MAX) unpricedReason = "25명 이상은 구성과 금액을 상담으로 안내해요.";
    else if (!input.date) unpricedReason = "날짜를 고르면 금액이 나와요.";
    else unpricedReason = "이 날짜의 기본 요금은 상담 후 안내해요.";
  }

  return {
    unit,
    unpricedReason,
    lines,
    optionsTotal,
    total,
    perPerson: total == null ? null : Math.round(total / input.headcount),
    deposit: total == null ? null : Math.round((total * DEPOSIT_RATE) / 1000) * 1000,
    minutes: BASE_MINUTES - (o.icebreaking ? 0 : OPTION.icebreaking.minutes),
  };
}

/**
 * 같은 장소에서 신청자가 있는 일반 회차의 시간대(KST). 단체가 이 시간과 겹치면 받을 수 없다.
 * 화면과 접수 API 가 같은 함수(overlapsBusy)로 본다.
 */
export type BusySlot = { date: string; start: string; end: string };

const hhmmToMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** date 의 time 부터 minutes 동안이 busy 의 어느 시간대와 겹치는가. */
export function overlapsBusy(busy: readonly BusySlot[], date: string, time: string, minutes: number): boolean {
  const s = hhmmToMin(time);
  const e = s + minutes;
  return busy.some((b) => {
    if (b.date !== date) return false;
    const bs = hhmmToMin(b.start);
    let be = hhmmToMin(b.end);
    if (be <= bs) be += 24 * 60; // 자정을 넘기는 회차
    return bs < e && be > s;
  });
}

/**
 * 운영자가 시간 구간으로 막은 일정(start ~ start+minutes)을 BusySlot 으로 바꾼다.
 * 구간 마감은 예약이 있는 시간과 똑같이 '겹치면 못 받는다' 로 본다(2026-10-30 대표님).
 * 종일 마감(time null)은 여기서 빼고 따로 본다. minutes 가 없으면(옛 행) 단체 기본 3시간.
 */
export function closureSlots(
  closures: readonly { date: string; time: string | null; minutes: number | null }[]
): BusySlot[] {
  return closures.flatMap((c) => {
    if (c.time == null) return [];
    const end = (hhmmToMin(c.time) + (c.minutes ?? BASE_MINUTES)) % 1440;
    return [{ date: c.date, start: c.time, end: `${pad(Math.floor(end / 60))}:${pad(end % 60)}` }];
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 분 → '3시간 30분'. 견적 카드와 타임테이블이 같이 쓴다. */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}시간` : "", m ? `${m}분` : ""].filter(Boolean).join(" ") || "0분";
}

/** 'HH:MM' + 분 → 'HH:MM'. 자정을 넘기면 '익일 ' 을 붙인다. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m + minutes;
  const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
  const mm = String(t % 60).padStart(2, "0");
  return `${t >= 1440 ? "익일 " : ""}${hh}:${mm}`;
}

export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** '12월 12일 (토)' */
export function dateLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${DAY_LABELS[weekdayOf(date)]})`;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
