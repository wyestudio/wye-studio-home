import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/adminAuth";
import { getTrafficSources, getLandingPages, getTopPages, getApplyFunnel } from "@/lib/ga4";

export const revalidate = 3600; // 1시간 캐시

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const adminAuthCookie = cookieStore.get("admin_auth")?.value;

    if (!adminAuthCookie || !verifyAdminToken(adminAuthCookie)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [trafficSources, landingPages, topPages, applyFunnel] = await Promise.all([
      getTrafficSources().catch(() => []),
      getLandingPages().catch(() => []),
      getTopPages().catch(() => []),
      getApplyFunnel().catch(() => []),
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
