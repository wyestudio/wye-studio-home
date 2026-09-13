import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 어드민 분석 화면이 쓰는 **우리 DB 쪽 숫자**.
 *
 * GA4 는 "몇 명이 들어왔나"까지만 안다. 실제로 몇 건이 신청됐고 입금까지
 * 됐는지, 매출이 얼마인지는 우리 DB 에만 있다. 둘을 같이 놓아야
 * "방문 대비 신청 전환율" 같은 진짜 지표가 나온다 —
 * 예약형 사업 대시보드의 기본 구성이다.
 *
 * ⚠️ 날짜는 전부 **KST 기준**으로 자른다. GA4 속성 시간대도 서울이라 두
 *    쪽 날짜가 어긋나지 않는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO → KST 기준 'YYYY-MM-DD' */
function kstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 오늘(KST)에서 n일 전 00:00 의 UTC ISO */
function kstDaysAgoStart(n: number): string {
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const start = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() - n
  );
  return new Date(start - KST_OFFSET_MS).toISOString();
}

export type DailyApplicationStat = {
  /** YYYY-MM-DD (KST) */
  date: string;
  /** 그날 접수된 신청 건수 (취소 포함 — '들어온 양'을 보는 값) */
  applications: number;
  /** 그날 접수된 신청의 인원 합계 */
  headcount: number;
  /** 그날 입금 확인된 건수 (신청일이 아니라 입금일 기준) */
  paid: number;
  /** 그날 입금 확인된 건의 금액 합계 */
  revenueKrw: number;
  /** 그날 취소된 건수 */
  cancelled: number;
};

export type ApplicationTotals = {
  applications: number;
  headcount: number;
  paid: number;
  revenueKrw: number;
  cancelled: number;
};

export type ApplicationStats = {
  daily: DailyApplicationStat[];
  totals: ApplicationTotals;
};

/**
 * 최근 n일(오늘 포함)의 신청·입금·취소 추이.
 *
 * 신청은 created_at, 입금은 paid_at, 취소는 cancelled_at 기준으로 **각각 다른
 * 날짜에** 센다. 한 건이 9/10에 신청되고 9/12에 입금됐다면 신청은 10일,
 * 입금은 12일에 잡힌다 — 그래야 "그날 실제로 일어난 일"이 된다.
 *
 * ⚠️ cancelled_at 은 2026-09-13 부터 쌓인다(p22). 그 이전 취소는 날짜를 알 수
 *    없어 취소 추이에서 빠진다.
 */
export async function getApplicationStats(days: number): Promise<ApplicationStats> {
  const supabase = createAdminClient();
  const since = kstDaysAgoStart(days - 1);

  // 입금·취소가 조회 구간에 들어오는 건은 신청일이 더 오래됐을 수 있어서
  // 세 날짜 중 하나라도 구간에 걸치면 가져온다.
  const { data, error } = await supabase
    .from("applications")
    .select("created_at, paid_at, cancelled_at, status, amount_krw, headcount")
    .or(`created_at.gte.${since},paid_at.gte.${since},cancelled_at.gte.${since}`);

  if (error) {
    console.error("[adminStats] 신청 통계 조회 실패", error);
    return { daily: [], totals: { applications: 0, headcount: 0, paid: 0, revenueKrw: 0, cancelled: 0 } };
  }

  // 빈 날짜도 0으로 채운다 — 차트에 구멍이 나면 추세가 왜곡돼 보인다.
  const bucket = new Map<string, DailyApplicationStat>();
  for (let i = days - 1; i >= 0; i--) {
    const d = kstDate(kstDaysAgoStart(i));
    bucket.set(d, { date: d, applications: 0, headcount: 0, paid: 0, revenueKrw: 0, cancelled: 0 });
  }

  for (const row of data ?? []) {
    const created = row.created_at ? kstDate(row.created_at as string) : null;
    const paid = row.paid_at ? kstDate(row.paid_at as string) : null;
    const cancelled = row.cancelled_at ? kstDate(row.cancelled_at as string) : null;
    const amount = (row.amount_krw as number) ?? 0;

    if (created && bucket.has(created)) {
      const b = bucket.get(created)!;
      b.applications += 1;
      b.headcount += (row.headcount as number) ?? 1;
    }
    if (paid && bucket.has(paid)) {
      const b = bucket.get(paid)!;
      b.paid += 1;
      b.revenueKrw += amount;
    }
    if (cancelled && bucket.has(cancelled)) {
      bucket.get(cancelled)!.cancelled += 1;
    }
  }

  const daily = [...bucket.values()];
  const totals = daily.reduce<ApplicationTotals>(
    (acc, d) => ({
      applications: acc.applications + d.applications,
      headcount: acc.headcount + d.headcount,
      paid: acc.paid + d.paid,
      revenueKrw: acc.revenueKrw + d.revenueKrw,
      cancelled: acc.cancelled + d.cancelled,
    }),
    { applications: 0, headcount: 0, paid: 0, revenueKrw: 0, cancelled: 0 }
  );

  return { daily, totals };
}
