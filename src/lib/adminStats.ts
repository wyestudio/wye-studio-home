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
    // 우리 기기에서 넣은 테스트 신청은 뺀다(internalTraffic.ts). 아래 두 함수도 같다.
    .eq("is_internal", false)
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

/** 유입경로별 신청 한 줄. */
export type ApplicationSourceStat = {
  /** 묶음 키 — utm_source, 없으면 referrer 호스트, 그것도 없으면 "direct" */
  key: string;
  /** 화면에 그대로 쓰는 이름 */
  label: string;
  /** utm_campaign 이 여럿이면 쉼표로 이어 붙인다. 없으면 null */
  campaigns: string | null;
  applications: number;
  headcount: number;
  paid: number;
  revenueKrw: number;
};

/**
 * 잼핏 같은 외부 플랫폼 입점이 **실제 신청**으로 이어지는지 보기 위한 값.
 *
 * GA4 의 '어디서 들어오나' 와 다르다. 저쪽은 방문까지만 센다.
 * 여기는 신청 한 건 한 건에 저장해 둔 유입경로라, 입금·매출까지 따라온다.
 *
 * ⚠️ utm 은 **2026-09-15(p29)부터** 쌓인다. 그 이전 신청은 전부 빈 값이라
 *    '직접/기타' 로 잡힌다. 한동안은 비교 대상이 되지 않는다.
 * ⚠️ 첫 유입 기준(first-touch)이다. 잼핏 → 홈 → 신청 이면 잼핏으로 센다.
 */
export async function getApplicationSources(days: number): Promise<ApplicationSourceStat[]> {
  const supabase = createAdminClient();
  const since = kstDaysAgoStart(days - 1);

  const { data, error } = await supabase
    .from("applications")
    .select("utm_source, utm_medium, utm_campaign, referrer, status, amount_krw, headcount, paid_at")
    .eq("is_internal", false)
    .gte("created_at", since);

  if (error) {
    console.error("[adminStats] 유입경로 통계 조회 실패", error);
    return [];
  }

  const bucket = new Map<string, ApplicationSourceStat & { campaignSet: Set<string> }>();

  for (const row of data ?? []) {
    const source = (row.utm_source as string | null)?.trim() || null;
    const referrer = (row.referrer as string | null)?.trim() || null;

    let key: string;
    let label: string;
    if (source) {
      key = source.toLowerCase();
      const medium = (row.utm_medium as string | null)?.trim();
      label = medium ? `${source} / ${medium}` : source;
    } else if (referrer) {
      // 주소 전체 말고 호스트만 묶는다 — 같은 사이트의 여러 글이 흩어지면 셈이 안 된다.
      let host = referrer;
      try {
        host = new URL(referrer).hostname.replace(/^www\./, "");
      } catch {
        /* 저장된 값이 주소가 아니면 그대로 쓴다 */
      }
      key = `ref:${host.toLowerCase()}`;
      label = `${host} (링크 타고 옴)`;
    } else {
      key = "direct";
      label = "직접 방문 · 출처 없음";
    }

    let b = bucket.get(key);
    if (!b) {
      b = {
        key,
        label,
        campaigns: null,
        applications: 0,
        headcount: 0,
        paid: 0,
        revenueKrw: 0,
        campaignSet: new Set<string>(),
      };
      bucket.set(key, b);
    }

    b.applications += 1;
    b.headcount += (row.headcount as number) ?? 1;
    if (row.paid_at) {
      b.paid += 1;
      b.revenueKrw += (row.amount_krw as number) ?? 0;
    }
    const campaign = (row.utm_campaign as string | null)?.trim();
    if (campaign) b.campaignSet.add(campaign);
  }

  return [...bucket.values()]
    .map(({ campaignSet, ...rest }) => ({
      ...rest,
      campaigns: campaignSet.size > 0 ? [...campaignSet].slice(0, 4).join(", ") : null,
    }))
    .sort((a, b) => b.applications - a.applications);
}

export type CampaignApplicationStat = {
  /** GA4 의 sessionSourceMedium 과 맞추기 위한 키. 'instagram / social' */
  sourceMedium: string;
  campaign: string;
  applications: number;
  headcount: number;
  paid: number;
  revenueKrw: number;
};

/**
 * 캠페인까지 쪼갠 신청 수.
 *
 * 왜 따로 두나
 *   getApplicationSources() 는 utm_source 하나로만 묶는다. 그래서 인스타 바이오·
 *   8월 게시물·926 이벤트가 전부 'instagram' 한 줄이 된다. 방문(GA4)과 나란히 놓고
 *   전환율을 보려면 **GA4 와 같은 축**으로 세야 한다.
 *
 * ⚠️ 키를 GA4 표기(`source / medium`)에 맞춰 만든다. 양쪽 축이 다르면 아무것도
 *    안 붙어서 표가 통째로 비는데, 그게 "유입이 없다" 로 잘못 읽힌다.
 *
 * ⚠️ utm 은 **2026-09-15 부터** 쌓인다. 그 이전 신청은 값이 없어 여기 안 잡힌다.
 * ⚠️ 첫 유입 기준(first-touch)이다. GA4 세션도 같은 기준이라 축이 맞는다.
 */
export async function getApplicationsByCampaign(
  days: number
): Promise<CampaignApplicationStat[]> {
  const supabase = createAdminClient();
  const since = kstDaysAgoStart(days - 1);

  const { data, error } = await supabase
    .from("applications")
    .select("utm_source, utm_medium, utm_campaign, status, amount_krw, headcount, paid_at")
    .eq("is_internal", false)
    .gte("created_at", since)
    .not("utm_source", "is", null);

  if (error) {
    console.error("[adminStats] 캠페인별 신청 통계 조회 실패", error);
    return [];
  }

  const bucket = new Map<string, CampaignApplicationStat>();

  for (const row of data ?? []) {
    const source = (row.utm_source as string | null)?.trim();
    const campaign = (row.utm_campaign as string | null)?.trim();
    // 캠페인이 없으면 GA4 쪽과 붙일 축이 없다. 소스 단위 표(위쪽)에서 이미 세고 있다.
    if (!source || !campaign) continue;

    const medium = (row.utm_medium as string | null)?.trim() || "(none)";
    const sourceMedium = `${source.toLowerCase()} / ${medium.toLowerCase()}`;
    const key = `${sourceMedium}|${campaign.toLowerCase()}`;

    let b = bucket.get(key);
    if (!b) {
      b = { sourceMedium, campaign, applications: 0, headcount: 0, paid: 0, revenueKrw: 0 };
      bucket.set(key, b);
    }

    b.applications += 1;
    b.headcount += (row.headcount as number) ?? 1;
    if (row.paid_at) {
      b.paid += 1;
      b.revenueKrw += (row.amount_krw as number) ?? 0;
    }
  }

  return [...bucket.values()].sort((a, b) => b.applications - a.applications);
}
