import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA4_PROPERTY_ID;
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Vercel 환경변수에 PEM 키를 저장하면 개행이 실제 줄바꿈이 아니라 "\n" 두 글자로
// 들어가는 경우가 있어(대시보드 입력창이 여러 줄을 그대로 보존하지 못함) 디코더가
// 파싱에 실패한다("DECODER routines::unsupported") — 여기서 되돌려준다.
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!propertyId || !serviceAccountEmail || !privateKey) {
  throw new Error("GA4 환경변수가 설정되지 않았습니다");
}

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: serviceAccountEmail,
    private_key: privateKey,
  },
});

/**
 * 테스트 기기 방문은 뺀다.
 *
 * 테스트 기기(/internal)에서 온 방문은 GTM 이 traffic_type=internal 을 붙이고,
 * GA4 의 'Internal Traffic' 데이터 필터가 걸러낸다. 그런데 필터가 **테스트 중**
 * 상태일 때는 빼지 않고 testDataFilterName 에 필터 이름만 적어 둔다. 그래서
 * 여기서 그 이름이 붙은 방문을 뺀다.
 *
 * 필터를 '사용' 으로 바꾸면 그런 방문은 애초에 수집되지 않으므로, 이 조건을
 * 그대로 둬도 결과는 같다.
 *
 * ⚠️ GA4 필터 이름을 그대로 쓴다. GA4 에서 필터 이름을 바꾸면 여기도 같이 바꾼다 —
 *    안 바꾸면 테스트 방문이 조용히 다시 섞인다.
 * ⚠️ '(not set)' 으로 거르는 조건은 GA4 가 거부한다(INVALID_ARGUMENT, 2026-09-17 실측).
 * ⚠️ 한 세션 안에서 표시를 켜고 끄면 양쪽에 다 잡혀 합이 1~2 어긋날 수 있다.
 * ⚠️ GTM 게시(2026-09-17) 이전 방문에는 표시가 없어 가를 수 없다.
 */
const TEST_FILTER_NAME = "Internal Traffic";
const TEST_TRAFFIC = {
  filter: {
    fieldName: "testDataFilterName",
    stringFilter: { matchType: "EXACT" as const, value: TEST_FILTER_NAME },
  },
};
const REAL_TRAFFIC = { notExpression: TEST_TRAFFIC };

/** 기존 조건이 있으면 '테스트 기기 제외' 와 AND 로 묶는다. */
function realOnly<T extends object>(filter?: T) {
  return filter ? { andGroup: { expressions: [REAL_TRAFFIC, filter] } } : REAL_TRAFFIC;
}

/** 기간 안의 테스트 기기 방문(세션) 수. 분석 화면에 '몇 회 뺐다' 고 알리는 데 쓴다. */
export async function getTestDeviceSessions(startDate: string): Promise<number> {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: "today" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: TEST_TRAFFIC,
  });
  return parseInt(res.rows?.[0]?.metricValues?.[0]?.value || "0", 10);
}

export interface TrafficSource {
  source: string;
  sessions: number;
}

export interface LandingPage {
  page: string;
  sessions: number;
}

export interface PageView {
  path: string;
  views: number;
}

export interface FunnelStep {
  step: string;
  events: number;
}

export async function getTrafficSources(startDate: string = "28daysAgo"): Promise<TrafficSource[]> {
  const response = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate,
        endDate: "today",
      },
    ],
    dimensions: [
      {
        name: "sessionSourceMedium",
      },
    ],
    metrics: [
      {
        name: "sessions",
      },
    ],
    orderBys: [
      {
        metric: {
          metricName: "sessions",
        },
        desc: true,
      },
    ],
    limit: 10,
    dimensionFilter: realOnly(),
  });

  return (response[0]?.rows || [])
    .filter((row) => row.dimensionValues && row.metricValues)
    .map((row) => ({
      source: row.dimensionValues![0].value || "직접",
      sessions: parseInt(row.metricValues![0].value || "0", 10),
    }));
}

/**
 * 캠페인까지 쪼갠 유입.
 *
 * 왜 따로 두나
 *   getTrafficSources() 는 소스/매체 한 축만 본다. 그런데 우리 인스타 링크는
 *   바이오(profile)·8월 게시물(0829_*)·926 오픈 이벤트(coupon_event_0926) 가
 *   전부 utm_campaign 으로만 갈린다. 소스/매체만 보면 이 셋이 한 줄로 뭉쳐
 *   "어느 홍보가 먹혔나" 를 답할 수 없다.
 *
 * ⚠️ 차원 이름은 2026-09-17 에 실제 GA4 속성에 질의해 확인한 값이다.
 *    틀린 차원을 넣으면 요청 전체가 에러가 나는데, 호출부가 실패를 빈 배열로
 *    삼키므로 화면에는 "데이터 없음" 으로만 보인다 — 조용히 죽는다.
 *    이름을 바꿀 일이 있으면 반드시 실제 질의로 확인하고 바꾼다.
 *
 * ⚠️ 조합 수가 많아 limit 을 넉넉히 둔다. 소스/매체 × 캠페인 × 진입지점이라
 *    10 으로 자르면 꼬리가 아니라 허리가 잘린다.
 */
export interface CampaignTraffic {
  /** 'instagram / social' */
  sourceMedium: string;
  /** utm_campaign. 값이 없으면 빈 문자열 */
  campaign: string;
  /** utm_content(진입 지점). 값이 없으면 빈 문자열 */
  content: string;
  sessions: number;
}

/** GA4 가 "값 없음" 을 뜻할 때 쓰는 표기들. 화면에서는 빈 값으로 취급한다. */
const GA4_EMPTY = new Set([
  "(not set)",
  "(direct)",
  "(none)",
  "(organic)",
  "(referral)",
  "(data not available)",
  "",
]);

function blankIfEmpty(raw: string | null | undefined): string {
  const v = (raw || "").trim();
  return GA4_EMPTY.has(v.toLowerCase()) ? "" : v;
}

export async function getCampaignTraffic(
  startDate: string = "28daysAgo"
): Promise<CampaignTraffic[]> {
  const response = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: "today" }],
    dimensions: [
      { name: "sessionSourceMedium" },
      { name: "sessionCampaignName" },
      { name: "sessionManualAdContent" },
    ],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 40,
    dimensionFilter: realOnly(),
  });

  return (response[0]?.rows || [])
    .filter((row) => row.dimensionValues && row.metricValues)
    .map((row) => ({
      sourceMedium: row.dimensionValues![0].value || "(not set)",
      campaign: blankIfEmpty(row.dimensionValues![1].value),
      content: blankIfEmpty(row.dimensionValues![2].value),
      sessions: parseInt(row.metricValues![0].value || "0", 10),
    }));
}

export async function getLandingPages(startDate: string = "28daysAgo"): Promise<LandingPage[]> {
  const response = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate,
        endDate: "today",
      },
    ],
    dimensions: [
      {
        name: "landingPage",
      },
    ],
    metrics: [
      {
        name: "sessions",
      },
    ],
    orderBys: [
      {
        metric: {
          metricName: "sessions",
        },
        desc: true,
      },
    ],
    limit: 10,
    dimensionFilter: realOnly(),
  });

  return (response[0]?.rows || [])
    .filter((row) => row.dimensionValues && row.metricValues)
    .map((row) => ({
      page: row.dimensionValues![0].value || "직접",
      sessions: parseInt(row.metricValues![0].value || "0", 10),
    }));
}

/*
 * 2026-09-13 제거 — getTopPages() / getApplyFunnel().
 *
 * getApplyFunnel 은 apply_start/apply_complete **이벤트**로 퍼널을 셌는데,
 * 테마 구조로 넘어오며 신규 신청폼이 이벤트를 안 쏘게 되어 사실상 0만 반환하고
 * 있었다(어드민 분석 화면이 "죽은 페이지"처럼 보였던 이유 중 하나).
 * 지금은 경로 기반 getPathFunnel() 로 대체했다 — 아래 참고.
 *
 * getTopPages 는 '유입 페이지'(getLandingPages)와 겹쳐 화면에서 뺐다.
 * 되살릴 일이 생기면 git 히스토리에 원본이 있다.
 */

// ─────────────────────────────────────────────────────────────────
// 2026-09-13 추가 — 어드민 분석 화면 개편용
//
// 기존 4개 함수는 "기간 합계 표"만 만들 수 있었다. 날짜별 추이도, 단계별
// 이탈률도 못 보여주니 화면이 죽어 있었다.
//
// ⚠️ 퍼널을 eventName(apply_start/apply_complete)으로 재지 않고 **페이지 경로**로
//    잰다. 이벤트는 GTM 설정·태그 게시에 의존해서 조용히 끊기기 쉽다(실제로
//    테마 구조로 넘어온 뒤 끊겨 있었다). 경로는 페이지가 열리기만 하면 잡힌다.
// ─────────────────────────────────────────────────────────────────

export interface DailyTraffic {
  /** YYYY-MM-DD */
  date: string;
  sessions: number;
  users: number;
  pageViews: number;
}

/** 날짜별 방문 추이. GA4 의 date 는 'YYYYMMDD' 라 하이픈을 넣어 돌려준다. */
export async function getDailyTraffic(startDate: string): Promise<DailyTraffic[]> {
  const [res] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 100,
    dimensionFilter: realOnly(),
  });

  return (res.rows || [])
    .filter((r) => r.dimensionValues && r.metricValues)
    .map((r) => {
      const d = r.dimensionValues![0].value || "";
      return {
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        sessions: parseInt(r.metricValues![0].value || "0", 10),
        users: parseInt(r.metricValues![1].value || "0", 10),
        pageViews: parseInt(r.metricValues![2].value || "0", 10),
      };
    });
}

export interface PathFunnel {
  /** 전체 세션 */
  sessions: number;
  /** 테마 상세를 본 세션 */
  themeSessions: number;
  /** 신청 폼까지 연 세션 */
  applySessions: number;
}

/**
 * 경로 기반 퍼널.
 *
 * 한 세션이 여러 페이지를 보므로 단계별 세션 수는 서로 겹친다 — "깔때기"가
 * 맞으려면 뒤 단계가 앞 단계의 부분집합이어야 하는데, 실제로 신청 폼은
 * 테마 상세를 거쳐야만 갈 수 있으므로 근사적으로 성립한다.
 */
/**
 * 경로 기반 퍼널.
 *
 * ⚠️ 경로별 세션 수를 **더하면 안 된다.** 한 세션이 테마 두 개를 보면 두 번
 *    세어져서, 실제로 "테마 상세 조회 = 방문 100%" 같은 숫자가 나온다(처음에
 *    그렇게 만들었다가 화면에서 바로 들통났다). GA4 에 필터를 걸어 "그 경로를
 *    본 세션 수"를 직접 물어야 중복이 제거된다.
 */
export async function getPathFunnel(startDate: string): Promise<PathFunnel> {
  const range = [{ startDate, endDate: "today" }];

  const beginsWith = (value: string) => ({
    filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH" as const, value } },
  });
  const endsWithApply = {
    filter: { fieldName: "pagePath", stringFilter: { matchType: "ENDS_WITH" as const, value: "/apply" } },
  };
  // 옛 회차 주소(/sessions/…)도 상품 상세다. 지금은 리다이렉트되지만 과거
  // 구간을 조회하면 여전히 잡힌다.
  const productPaths = { orGroup: { expressions: [beginsWith("/themes/"), beginsWith("/sessions/")] } };

  const [total, product, apply] = await Promise.all([
    analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: range,
      metrics: [{ name: "sessions" }],
      dimensionFilter: realOnly(),
    }),
    analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: range,
      metrics: [{ name: "sessions" }],
      // 상품 상세만 — 신청 폼(/apply)은 뺀다.
      dimensionFilter: realOnly({
        andGroup: {
          expressions: [productPaths, { notExpression: endsWithApply }],
        },
      }),
    }),
    analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: range,
      metrics: [{ name: "sessions" }],
      dimensionFilter: realOnly(endsWithApply),
    }),
  ]);

  // runReport 는 [응답, 요청, 메타] 튜플을 준다. 첫 칸만 쓴다.
  type ReportTuple = { rows?: { metricValues?: { value?: string | null }[] | null }[] | null };
  const num = (r: unknown) => {
    const res = (r as [ReportTuple])[0];
    return parseInt(res?.rows?.[0]?.metricValues?.[0]?.value || "0", 10);
  };

  const sessions = num(total);
  const applySessions = num(apply);
  // 신청 폼을 연 세션은 상세도 거쳤다고 본다. 깔때기가 뒤집혀 보이면 안 된다.
  const themeSessions = Math.min(sessions, Math.max(num(product), applySessions));

  return { sessions, themeSessions, applySessions: Math.min(themeSessions, applySessions) };
}
