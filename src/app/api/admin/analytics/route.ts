import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/adminAuth";
import {
  getTrafficSources,
  getCampaignTraffic,
  getLandingPages,
  getDailyTraffic,
  getPathFunnel,
} from "@/lib/ga4";
import { getApplicationStats, getApplicationSources } from "@/lib/adminStats";

export const revalidate = 300; // 5분 캐시 — 하루 단위로 보려면 1시간은 너무 굼뜨다

/** 기간 선택지. 숫자는 '오늘 포함 며칠' 이다. */
const DAYS_BY_PERIOD: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 28,
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const adminAuthCookie = cookieStore.get("admin_auth")?.value;

    if (!adminAuthCookie || !verifyAdminToken(adminAuthCookie)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get("period") || "weekly";
    const days = DAYS_BY_PERIOD[period] ?? DAYS_BY_PERIOD.weekly;
    // GA4 는 '오늘 포함 n일' 을 (n-1)daysAgo 로 쓴다.
    const startDate = days === 1 ? "today" : `${days - 1}daysAgo`;

    // ⚠️ 한 조각이 실패해도 화면 전체가 죽으면 안 된다. GA4 는 자격증명·할당량
    //    문제로 간헐적으로 실패한다. 실패한 조각만 비우고 나머지는 보여준다.
    const named = <T>(name: string, fallback: T) => (err: unknown): T => {
      console.error(`Analytics ${name} error:`, err);
      return fallback;
    };

    const [
      trafficSources,
      campaignTraffic,
      landingPages,
      dailyTraffic,
      funnel,
      appStats,
      appSources,
    ] = await Promise.all([
      getTrafficSources(startDate).catch(named("trafficSources", [])),
      getCampaignTraffic(startDate).catch(named("campaignTraffic", [])),
      getLandingPages(startDate).catch(named("landingPages", [])),
      getDailyTraffic(startDate).catch(named("dailyTraffic", [])),
      getPathFunnel(startDate).catch(
        named("pathFunnel", { sessions: 0, themeSessions: 0, applySessions: 0 })
      ),
      getApplicationStats(days).catch(
        named("applicationStats", {
          daily: [],
          totals: { applications: 0, headcount: 0, paid: 0, revenueKrw: 0, cancelled: 0 },
        })
      ),
      getApplicationSources(days).catch(named("applicationSources", [])),
    ]);

    return NextResponse.json({
      period,
      days,
      trafficSources,
      campaignTraffic,
      landingPages,
      dailyTraffic,
      funnel,
      applications: appStats,
      applicationSources: appSources,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
