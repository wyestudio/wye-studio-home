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
  });

  return (response[0]?.rows || [])
    .filter((row) => row.dimensionValues && row.metricValues)
    .map((row) => ({
      source: row.dimensionValues![0].value || "직접",
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
    }),
    analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: range,
      metrics: [{ name: "sessions" }],
      // 상품 상세만 — 신청 폼(/apply)은 뺀다.
      dimensionFilter: {
        andGroup: {
          expressions: [productPaths, { notExpression: endsWithApply }],
        },
      },
    }),
    analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: range,
      metrics: [{ name: "sessions" }],
      dimensionFilter: endsWithApply,
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
