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

    const debug = request.nextUrl.searchParams.get("debug") === "1";
    const errors: Record<string, string> = {};
    const catchNamed = (name: string) => (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Analytics ${name} error:`, err);
      errors[name] = message;
      return [];
    };

    const [trafficSources, landingPages, topPages, applyFunnel] = await Promise.all([
      getTrafficSources().catch(catchNamed("trafficSources")),
      getLandingPages().catch(catchNamed("landingPages")),
      getTopPages().catch(catchNamed("topPages")),
      getApplyFunnel().catch(catchNamed("applyFunnel")),
    ]);

    return NextResponse.json({
      trafficSources,
      landingPages,
      topPages,
      applyFunnel,
      ...(debug ? { _debugErrors: errors } : {}),
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
