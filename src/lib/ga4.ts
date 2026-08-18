import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const propertyId = process.env.GA4_PROPERTY_ID;
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

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

export async function getTrafficSources(): Promise<TrafficSource[]> {
  const response = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: "28daysAgo",
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

export async function getLandingPages(): Promise<LandingPage[]> {
  const response = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: "28daysAgo",
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

export async function getTopPages(): Promise<PageView[]> {
  const response = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: "28daysAgo",
        endDate: "today",
      },
    ],
    dimensions: [
      {
        name: "pagePath",
      },
    ],
    metrics: [
      {
        name: "screenPageViews",
      },
    ],
    orderBys: [
      {
        metric: {
          metricName: "screenPageViews",
        },
        desc: true,
      },
    ],
    limit: 10,
  });

  return (response[0]?.rows || [])
    .filter((row) => row.dimensionValues && row.metricValues)
    .map((row) => ({
      path: row.dimensionValues![0].value || "/",
      views: parseInt(row.metricValues![0].value || "0", 10),
    }));
}

export async function getApplyFunnel(): Promise<FunnelStep[]> {
  try {
    const response = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: "28daysAgo",
          endDate: "today",
        },
      ],
      dimensions: [
        {
          name: "eventName",
        },
      ],
      metrics: [
        {
          name: "eventCount",
        },
      ],
    } as Parameters<typeof analyticsDataClient.runReport>[0]);

    const rows = response[0]?.rows || [];
    const eventMap = new Map<string, number>();

    rows.forEach((row: any) => {
      if (row.dimensionValues && row.metricValues) {
        const eventName = row.dimensionValues[0]?.value || "";
        const count = parseInt(row.metricValues[0]?.value || "0", 10);
        if (eventName === "apply_start" || eventName === "apply_complete") {
          eventMap.set(eventName, count);
        }
      }
    });

    return [
      {
        step: "신청 폼 진입",
        events: eventMap.get("apply_start") || 0,
      },
      {
        step: "신청 완료",
        events: eventMap.get("apply_complete") || 0,
      },
    ];
  } catch (error) {
    console.error("Failed to fetch apply funnel:", error);
    return [
      {
        step: "신청 폼 진입",
        events: 0,
      },
      {
        step: "신청 완료",
        events: 0,
      },
    ];
  }
}
