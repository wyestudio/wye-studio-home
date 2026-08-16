import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEventReminderSms } from "@/lib/sms";
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
      .select("id, title, event_date, start_at, end_at, theme_label, theme_name, session_type")
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

    const sessionIds = sessions.map((s) => s.id);

    // 해당 세션들의 확정된 신청 조회 (reminder_sms_sent_at이 null인 것만)
    const { data: applications, error: appError } = await supabase
      .from("applications")
      .select("id, session_id, confirmation_code, status, payment_status")
      .eq("status", "confirmed")
      .eq("payment_status", "confirmed")
      .is("reminder_sms_sent_at", null)
      .in("session_id", sessionIds);

    if (appError) {
      console.error("[cron] 신청 조회 오류:", appError);
      return NextResponse.json(
        { error: "신청 조회 실패", details: appError.message },
        { status: 500 }
      );
    }

    if (!applications || applications.length === 0) {
      return NextResponse.json(
        { success: true, count: 0, message: "처리할 신청이 없습니다." }
      );
    }

    let successCount = 0;
    const errors: string[] = [];

    // 세션 ID를 문자열로 정규화한 맵 생성
    const sessionMap = new Map(sessions.map((s) => [String(s.id), s]));

    // 각 신청에 대해 참가확정 알림 발송
    for (const app of applications) {
      try {
        const session = sessionMap.get(String(app.session_id)) as Session | undefined;
        if (!session) {
          errors.push(`신청 ${app.confirmation_code}: 세션 정보 없음 (session_id: ${app.session_id})`);
          continue;
        }

        // 대표 신청자의 전화번호 조회 (복호화는 불가능하므로 어드민 뷰 사용)
        const { data: attendee } = await supabase
          .from("admin_attendee_view")
          .select("phone")
          .eq("application_id", app.id)
          .eq("is_representative", true)
          .single();

        if (!attendee || !attendee.phone) {
          errors.push(`신청 ${app.confirmation_code}: 대표 신청자 연락처 없음`);
          continue;
        }

        // 장소 정보 조회
        const { data: venue } = await supabase
          .from("session_venues")
          .select("venue_name, venue_address")
          .eq("session_id", session.id)
          .single();

        const venueName = venue?.venue_name || "미정";

        // SMS 발송
        await sendEventReminderSms(session, app as any, attendee.phone, venueName, venue?.venue_address ?? null);

        // reminder_sms_sent_at 기록
        await supabase
          .from("applications")
          .update({ reminder_sms_sent_at: new Date().toISOString() })
          .eq("id", app.id);

        successCount++;
      } catch (err) {
        console.error(`[cron] SMS 발송 실패 (${app.confirmation_code}):`, err);
        errors.push(`신청 ${app.confirmation_code}: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      }
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      total: applications.length,
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
