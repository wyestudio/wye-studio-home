import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSessionReminders } from "@/lib/reminderSms";
import type { Session } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 토큰 인증 (쿼리 파라미터 또는 헤더)
  const tokenFromQuery = request.nextUrl.searchParams.get("token");
  const tokenFromHeader = request.headers.get("x-cron-secret");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const token = tokenFromQuery || tokenFromHeader;
  if (!token || token !== expectedToken) {
    return NextResponse.json(
      { error: "인증 실패" },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();

    // 24시간 이내에 시작하는 회차 조회 (시간 필터가 필요하므로 sessions에서 먼저)
    const now = new Date();
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // status='closed'는 정원마감(참가자에게는 정상 진행되는 회차)이라 리마인더
    // 대상에 포함해야 한다 — 최소인원 미달로 비활성화된('cancelled') 회차만 제외.
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .neq("status", "cancelled")
      .gte("start_at", now.toISOString())
      .lte("start_at", oneDayLater.toISOString());

    if (sessionsError) {
      console.error("[cron] 세션 조회 오류:", sessionsError);
      return NextResponse.json(
        { error: "세션 조회 실패", details: sessionsError.message },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { success: true, count: 0, message: "24시간 내 시작 세션이 없습니다." }
      );
    }

    let successCount = 0;
    let totalCount = 0;
    const errors: string[] = [];

    for (const session of sessions as Session[]) {
      const result = await sendSessionReminders(supabase, session);
      successCount += result.count;
      totalCount += result.total;
      if (result.errors) errors.push(...result.errors);
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      total: totalCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[cron] 크론 작업 오류:", err);
    return NextResponse.json(
      { error: "내부 서버 오류", details: err instanceof Error ? err.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
