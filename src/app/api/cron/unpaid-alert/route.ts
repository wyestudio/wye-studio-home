import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeDotted } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 입금기한(신청 후 30분)이 지났는데 아직 입금 확인이 안 된 신청을 모아 Slack 으로 알린다.
 *
 * ⚠️ **자동 취소하지 않는다.** 왜 표시만 하는가:
 *    자동 취소는 payment_status='pending' 을 "돈을 안 냈다" 의 근거로 쓰는데,
 *    지금 이 값을 confirmed 로 바꾸는 것은 **사람**이다(대표님이 통장을 보고
 *    어드민 '입금 확인' 버튼을 누른다). 즉 30분 타이머가 재는 것은 고객의
 *    입금 시간이 아니라 **운영자의 확인 시간**이다.
 *
 *    실제로 8/29 데이터를 재보니 신청→입금확인까지 중앙값은 4분이었지만
 *    46건 중 8건(17%)이 30분을 넘었고 최대 2.8일이 걸렸다. 그 상태에서
 *    자동 취소를 켰다면 **돈을 낸 고객 8명이 취소 문자를 받았을 것**이다.
 *
 *    입금 자동 확인(Phase 5-2/5-3)이 들어와 payment_status 가 실제 입금을
 *    반영하게 된 뒤에야 자동 취소가 안전해진다. 그때까지는 알림만 한다.
 *    배경: docs/09-implementation-roadmap.md Phase 5
 *
 * ⚠️ 이미 지난 회차는 제외한다. 이제 와서 입금을 받을 일이 없다.
 */

/** 입금기한. 신청 완료 화면·문자1 이 안내하는 "30분" 과 같아야 한다. */
const DEADLINE_MINUTES = 30;

/** 한 번에 나열할 최대 건수. 너무 길면 Slack 이 자른다. */
const MAX_LINES = 20;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!token || token !== expected) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();
    const deadline = new Date(now.getTime() - DEADLINE_MINUTES * 60 * 1000).toISOString();

    // 아직 진행하지 않은 회차만. 취소된 회차도 제외한다.
    const { data: sessions, error: sessionsError } = await supabase
      .from("session_display")
      .select("id, theme_name, start_at")
      .neq("status", "cancelled")
      .gte("start_at", now.toISOString());

    if (sessionsError) {
      console.error("[cron] 회차 조회 오류:", sessionsError);
      return NextResponse.json({ error: "회차 조회 실패", details: sessionsError.message }, { status: 500 });
    }

    const sessionById = new Map((sessions ?? []).map((s) => [s.id as string, s]));
    if (sessionById.size === 0) {
      return NextResponse.json({ success: true, count: 0, message: "진행 예정 회차가 없습니다." });
    }

    const { data: apps, error: appsError } = await supabase
      .from("admin_application_view")
      .select("id, session_id, confirmation_code, depositor_name, created_at, status, payment_status")
      .eq("status", "confirmed")
      .eq("payment_status", "pending")
      .lt("created_at", deadline)
      .in("session_id", [...sessionById.keys()])
      .order("created_at", { ascending: true });

    if (appsError) {
      console.error("[cron] 신청 조회 오류:", appsError);
      return NextResponse.json({ error: "신청 조회 실패", details: appsError.message }, { status: 500 });
    }

    const overdue = apps ?? [];
    if (overdue.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "기한 넘긴 미입금 건이 없습니다." });
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("[cron] SLACK_WEBHOOK_URL 미설정 — 알림을 건너뜁니다.");
      return NextResponse.json({ success: true, count: overdue.length, notified: false });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
    const lines = overdue.slice(0, MAX_LINES).map((a) => {
      const s = sessionById.get(a.session_id as string);
      const mins = Math.floor((now.getTime() - new Date(a.created_at as string).getTime()) / 60000);
      return `• \`${a.confirmation_code}\` ${a.depositor_name ?? "-"} — ${s?.theme_name ?? "-"} ${
        s ? formatDateTimeDotted(s.start_at as string) : ""
      } (신청 후 ${mins}분 경과)`;
    });
    if (overdue.length > MAX_LINES) {
      lines.push(`… 외 ${overdue.length - MAX_LINES}건`);
    }

    const text = [
      `⏰ 입금기한(${DEADLINE_MINUTES}분) 넘긴 미입금 신청 ${overdue.length}건`,
      "",
      ...lines,
      "",
      // ⚠️ 자동 취소는 하지 않는다는 것을 알림에도 적어둔다.
      //    받는 사람이 "시스템이 알아서 취소했겠지" 라고 오해하면 안 된다.
      "자동 취소되지 않습니다. 확인 후 어드민에서 처리해주세요.",
      `${siteUrl.replace("www.", "admin.")}/applications?status=confirmed&payment=pending`,
    ].join("\n");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error("[cron] Slack 알림 실패", res.status, await res.text());
      return NextResponse.json({ error: "Slack 알림 실패", status: res.status }, { status: 500 });
    }

    console.log(`[cron] 미입금 알림 발송: ${overdue.length}건`);
    return NextResponse.json({ success: true, count: overdue.length, notified: true });
  } catch (err) {
    console.error("[cron] 미입금 알림 오류:", err);
    return NextResponse.json(
      { error: "내부 서버 오류", details: err instanceof Error ? err.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
