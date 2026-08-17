import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/types/domain";
import { sendEventReminderSms } from "@/lib/sms";

// 크론(/api/cron/reminder)과 어드민 "전날안내 발송" 버튼이 공유하는 발송 로직 —
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
  const errors: string[] = [];
  let successCount = 0;

  for (const app of applications) {
    try {
      const { data: attendee } = await supabase
        .from("admin_attendee_view")
        .select("phone")
        .eq("application_id", app.id)
        .eq("is_representative", true)
        .single();

      if (!attendee?.phone) {
        errors.push(`신청 ${app.confirmation_code}: 대표 신청자 연락처 없음`);
        continue;
      }

      await sendEventReminderSms(session, app, attendee.phone, venueName, venue?.venue_address ?? null);

      await supabase
        .from("applications")
        .update({ reminder_sms_sent_at: new Date().toISOString() })
        .eq("id", app.id);

      successCount++;
    } catch (err) {
      errors.push(`신청 ${app.confirmation_code}: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  }

  return { count: successCount, total: applications.length, errors: errors.length > 0 ? errors : undefined };
}
