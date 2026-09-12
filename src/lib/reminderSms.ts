import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/types/domain";
import { buildEventReminderText } from "@/lib/sms";
import { getSessionDisplay, buildEventReminderTextV2 } from "@/lib/smsV2";
import { sendSmsBulk, type BulkMessage } from "@/lib/smsBulk";

export type ReminderRecipient = {
  name: string;
  phone: string;
  confirmationCode: string;
};

export type ReminderPreview = {
  total: number;
  recipients: ReminderRecipient[];
  messagePreview: string;
  skipped?: string[];
};

// 어드민 "장소안내 발송" 확인창에 실제 수신자·문구를 미리 보여주기 위한 조회 전용
// 함수. sendSessionReminders와 같은 대상 조건(확정+입금확인+미발송)을 공유한다.
export async function getSessionReminderPreview(
  supabase: SupabaseClient,
  session: Session
): Promise<ReminderPreview> {
  const { data: applications, error: appsError } = await supabase
    .from("applications")
    .select("id, confirmation_code")
    .eq("session_id", session.id)
    .eq("status", "confirmed")
    .eq("payment_status", "confirmed")
    .is("reminder_sms_sent_at", null);

  const { data: venue } = await supabase
    .from("session_venues")
    .select("venue_name, venue_address")
    .eq("session_id", session.id)
    .single();

  const venueName = venue?.venue_name || "미정";

  // 신규(테마 기반) 회차는 장소를 venues 에서, 옛 회차는 session_venues 에서 읽는다.
  // 템플릿도 달라 분기한다 — 옛 템플릿에는 소개팅 분기와 음주 문구가 있다.
  const sd = session.theme_id ? await getSessionDisplay(session.id) : null;
  const messagePreview = sd
    ? await buildEventReminderTextV2(sd, "OOO", sd.venue_address ?? null, sd.venue_parking_note ?? null)
    : await buildEventReminderText(session, "OOO", venueName, venue?.venue_address ?? null);

  if (appsError || !applications || applications.length === 0) {
    return { total: 0, recipients: [], messagePreview };
  }

  const recipients: ReminderRecipient[] = [];
  const skipped: string[] = [];

  // 신청 건마다 한 번씩 조회하지 않고 한 번에 모아 읽는다(발송 쪽과 같은 방식).
  const { data: reps } = await supabase
    .from("admin_attendee_view")
    .select("application_id, name, phone")
    .in("application_id", applications.map((a) => a.id))
    .eq("is_representative", true);

  const repByApp = new Map(
    (reps ?? []).map((r) => [r.application_id as string, r as { name: string; phone: string }])
  );

  for (const app of applications) {
    const attendee = repByApp.get(app.id);

    if (!attendee?.phone || !attendee?.name) {
      skipped.push(`신청 ${app.confirmation_code}: 대표 신청자 연락처 없음`);
      continue;
    }

    recipients.push({ name: attendee.name, phone: attendee.phone, confirmationCode: app.confirmation_code });
  }

  return {
    total: applications.length,
    recipients,
    messagePreview,
    skipped: skipped.length > 0 ? skipped : undefined,
  };
}

// 크론(/api/cron/reminder)과 어드민 "장소안내 발송" 버튼이 공유하는 발송 로직 —
// 세션 하나를 받아 확정+입금확인된, 아직 리마인더를 못 받은 신청 전체에 발송한다.
export async function sendSessionReminders(
  supabase: SupabaseClient,
  session: Session
): Promise<{ count: number; total: number; errors?: string[] }> {
  const { data: applications, error: appsError } = await supabase
    .from("applications")
    .select("id, session_id, confirmation_code, status, payment_status")
    .eq("session_id", session.id)
    .eq("status", "confirmed")
    .eq("payment_status", "confirmed")
    .is("reminder_sms_sent_at", null);

  if (appsError || !applications || applications.length === 0) {
    return { count: 0, total: 0 };
  }

  const { data: venue } = await supabase
    .from("session_venues")
    .select("venue_name, venue_address")
    .eq("session_id", session.id)
    .single();

  const venueName = venue?.venue_name || "미정";
  // 신규(테마 기반) 회차는 장소를 venues 에서 읽고 템플릿도 다르다.
  // 루프 안에서 매번 조회할 이유가 없어 한 번만 구한다.
  const sdSend = session.theme_id ? await getSessionDisplay(session.id) : null;
  const errors: string[] = [];

  // 대표 신청자를 신청 건마다 한 번씩 조회하던 것을 한 번에 모아 읽는다.
  // 40명이면 왕복이 40번이었다.
  const { data: reps } = await supabase
    .from("admin_attendee_view")
    .select("application_id, name, phone")
    .in("application_id", applications.map((a) => a.id))
    .eq("is_representative", true);

  const repByApp = new Map(
    (reps ?? []).map((r) => [r.application_id as string, r as { name: string; phone: string }])
  );

  // 문구는 사람마다 이름만 다르다. 먼저 전부 만들어 두고 한 번에 보낸다.
  const messages: BulkMessage[] = [];
  for (const app of applications) {
    const attendee = repByApp.get(app.id);
    if (!attendee?.phone || !attendee?.name) {
      errors.push(`신청 ${app.confirmation_code}: 대표 신청자 연락처 없음`);
      continue;
    }
    try {
      const text = sdSend
        ? await buildEventReminderTextV2(
            sdSend,
            attendee.name,
            sdSend.venue_address ?? null,
            sdSend.venue_parking_note ?? null
          )
        : await buildEventReminderText(session, attendee.name, venueName, venue?.venue_address ?? null);
      messages.push({ key: app.id, to: attendee.phone, text });
    } catch (err) {
      errors.push(`신청 ${app.confirmation_code}: ${err instanceof Error ? err.message : "문구 생성 실패"}`);
    }
  }

  // 솔라피 한 번의 요청으로 전원에게 보낸다.
  const { sentKeys, failures } = await sendSmsBulk(messages, "장소안내 문자");

  const codeByApp = new Map(applications.map((a) => [a.id, a.confirmation_code as string]));
  for (const f of failures) {
    errors.push(`신청 ${codeByApp.get(f.key) ?? f.key}: ${f.reason}`);
  }

  // ⚠️ 실제로 접수된 건만 발송 표시를 남긴다. 실패한 건은 표시가 없으므로
  //    다음 크론 실행이 그 사람만 다시 시도한다.
  if (sentKeys.length > 0) {
    const { error: markError } = await supabase
      .from("applications")
      .update({ reminder_sms_sent_at: new Date().toISOString() })
      .in("id", sentKeys);
    if (markError) {
      // 문자는 이미 나갔는데 표시를 못 남긴 상태다. 다음 실행이 중복 발송할 수
      // 있으므로 반드시 눈에 띄게 남긴다.
      console.error("[reminderSms] 발송 표시 실패 — 중복 발송 위험", markError, sentKeys);
      errors.push(`발송 표시 실패(중복 발송 위험): ${markError.message}`);
    }
  }

  return {
    count: sentKeys.length,
    total: applications.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}
