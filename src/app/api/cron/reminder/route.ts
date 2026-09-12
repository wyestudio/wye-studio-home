import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSessionReminders } from "@/lib/reminderSms";
import type { Session } from "@/types/domain";

export const dynamic = "force-dynamic";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * KST 기준으로 `from` 으로부터 `daysAhead` 일 뒤 하루의 끝(23:59:59.999)을
 * UTC 시각으로 돌려준다.
 *
 * 서버는 UTC 로 돈다. KST 날짜를 구하려면 9시간을 더한 뒤 UTC 날짜 부분을 읽고,
 * 다시 9시간을 빼서 실제 시각으로 되돌려야 한다.
 * Date.UTC 는 일(day) 넘침을 알아서 처리하므로 월말·연말도 따로 다루지 않는다.
 */
function kstDayEnd(from: Date, daysAhead: number): Date {
  const kst = new Date(from.getTime() + KST_OFFSET_MS);
  return new Date(
    Date.UTC(
      kst.getUTCFullYear(),
      kst.getUTCMonth(),
      kst.getUTCDate() + daysAhead,
      23,
      59,
      59,
      999
    ) - KST_OFFSET_MS
  );
}

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

    // "진행일 이틀 전" 에 해당하는 회차를 고른다 (시간 필터라 sessions 에서 먼저).
    //
    // 전날이 아니라 이틀 전에 보낸다 — 장소를 미리 알려드려야 참석이 어려운
    // 분이 일찍 취소할 수 있다.
    //
    // ⚠️ "지금부터 48시간" 이 아니라 **날짜 기준**이다. 시간 기준이면 크론을
    //    하루 한 번(10:00) 돌릴 때 이틀 전 안내가 하루 전 안내로 밀린다:
    //      목 10:00 실행 → 창이 토 10:00 까지 → 토 11:30 회차가 1시간 반 차이로 빠짐
    //      금 10:00 실행에서야 잡혀 "하루 전" 이 된다
    //    환불 규정도 p6 에서 시각(48/24h) → 날짜(4/3/2일) 기준으로 바뀌었으므로
    //    안내 시점도 날짜로 세는 것이 규정과 일관된다.
    //
    // ⚠️ 상한만 "이틀 뒤 끝" 으로 두고 하한은 now 로 둔다. 날짜가 정확히
    //    일치하는 회차만 고르면, 크론이 하루 걸러 실행되지 못했을 때 그날
    //    대상이던 회차가 **영영 안내를 못 받는다**. 상한만 두면 다음 실행이
    //    놓친 회차까지 같이 잡아 저절로 복구된다(하루 전 안내가 되긴 하지만
    //    아예 못 받는 것보다 낫다).
    //    이미 보낸 건은 reminder_sms_sent_at 으로 걸러져 중복 발송은 불가능하다.
    const now = new Date();
    const windowEnd = kstDayEnd(now, 2);

    // status='closed'는 정원마감(참가자에게는 정상 진행되는 회차)이라 리마인더
    // 대상에 포함해야 한다 — 최소인원 미달로 비활성화된('cancelled') 회차만 제외.
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .neq("status", "cancelled")
      .gte("start_at", now.toISOString())
      .lte("start_at", windowEnd.toISOString());

    if (sessionsError) {
      console.error("[cron] 세션 조회 오류:", sessionsError);
      return NextResponse.json(
        { error: "세션 조회 실패", details: sessionsError.message },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { success: true, count: 0, message: "안내 대상 회차가 없습니다." }
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
