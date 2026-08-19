import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getTrafficSources, getLandingPages, getTopPages, getApplyFunnel } from "@/lib/ga4";

export const revalidate = 3600; // 1시간 캐시

const START_DATE_BY_PERIOD: Record<string, string> = {
  weekly: "7daysAgo",
  monthly: "28daysAgo",
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const adminAuthCookie = cookieStore.get("admin_auth")?.value;

    if (!adminAuthCookie || !verifyAdminToken(adminAuthCookie)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get("period") || "monthly";
    const startDate = START_DATE_BY_PERIOD[period] || START_DATE_BY_PERIOD.monthly;

    const catchNamed = (name: string) => (err: unknown) => {
      console.error(`Analytics ${name} error:`, err);
      return [];
    };

    const [trafficSources, landingPages, topPages, applyFunnel] = await Promise.all([
      getTrafficSources(startDate).catch(catchNamed("trafficSources")),
      getLandingPages(startDate).catch(catchNamed("landingPages")),
      getTopPages(startDate).catch(catchNamed("topPages")),
      getApplyFunnel(startDate).catch(catchNamed("applyFunnel")),
    ]);

    return NextResponse.json({
      trafficSources,
      landingPages,
      topPages,
      applyFunnel,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
