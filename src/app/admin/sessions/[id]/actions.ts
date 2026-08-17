"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendPaymentConfirmedSms,
  sendApplicationCancelledSms,
  sendWaitlistPromotedSms,
  sendMinimumNotMetCancellationSms,
} from "@/lib/sms";
import { requireAdminAuth } from "@/lib/adminAuth";
import { sendSessionReminders } from "@/lib/reminderSms";

async function getRepresentative(supabase: ReturnType<typeof createAdminClient>, applicationId: string) {
  const { data, error } = await supabase
    .from("admin_attendee_view")
    .select("name, phone")
    .eq("application_id", applicationId)
    .eq("is_representative", true)
    .single();
  if (error || !data?.phone || !data?.name) return null;
  return { name: data.name as string, phone: data.phone as string };
}

async function getAttendeeCount(supabase: ReturnType<typeof createAdminClient>, applicationId: string) {
  const { count } = await supabase
    .from("admin_attendee_view")
    .select("*", { count: "exact", head: true })
    .eq("application_id", applicationId);
  return count ?? 1;
}

export async function confirmPayment(applicationId: string, sessionId: string) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const supabase = createAdminClient();

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    return { error: "신청 정보를 찾을 수 없습니다." };
  }

  if (application.status !== "confirmed") {
    return { error: "확정된 신청만 입금 확인할 수 있습니다." };
  }

  const { data: session, error: sessError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const representative = await getRepresentative(supabase, applicationId);
  if (!representative) {
    return { error: "대표 신청자를 찾을 수 없습니다." };
  }
  const attendeeCount = await getAttendeeCount(supabase, applicationId);

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      payment_status: "confirmed",
      payment_confirmed_sms_sent_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "업데이트 실패: " + updateError.message };
  }

  await sendPaymentConfirmedSms(session, application, representative, attendeeCount);

  console.log(`[admin] 입금 확인됨: ${applicationId} (${application.confirmation_code})`);

  return { success: true };
}

// 문자4(미입금 취소 안내) — 어드민이 "신청 취소" 버튼을 눌렀을 때 신청을
// cancelled로 전환하고 안내 문자를 보낸다.
export async function cancelApplicationAdmin(applicationId: string, sessionId: string) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const supabase = createAdminClient();

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    return { error: "신청 정보를 찾을 수 없습니다." };
  }

  if (application.status === "cancelled") {
    return { error: "이미 취소된 신청입니다." };
  }

  const { data: session, error: sessError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const representative = await getRepresentative(supabase, applicationId);
  if (!representative) {
    return { error: "대표 신청자를 찾을 수 없습니다." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "cancelled", payment_status: "cancelled" })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "업데이트 실패: " + updateError.message };
  }

  await sendApplicationCancelledSms(session, application, representative);

  console.log(`[admin] 신청 취소됨(미입금): ${applicationId} (${application.confirmation_code})`);

  return { success: true };
}

// 문자6(공석 입금 안내) — 어드민이 대기자와 유선 통화 후 참여 의사를 확인하면
// "대기→확정 전환" 버튼으로 status를 confirmed로 바꾸고 입금 안내 문자를 보낸다.
export async function promoteWaitlistApplicant(applicationId: string, sessionId: string) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const supabase = createAdminClient();

  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    return { error: "신청 정보를 찾을 수 없습니다." };
  }

  if (application.status !== "waiting") {
    return { error: "대기 상태인 신청만 확정으로 전환할 수 있습니다." };
  }

  const { data: session, error: sessError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const representative = await getRepresentative(supabase, applicationId);
  if (!representative) {
    return { error: "대표 신청자를 찾을 수 없습니다." };
  }
  const attendeeCount = await getAttendeeCount(supabase, applicationId);

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "confirmed" })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "업데이트 실패: " + updateError.message };
  }

  await sendWaitlistPromotedSms(session, application, representative, attendeeCount);

  console.log(`[admin] 대기자 확정 전환됨: ${applicationId} (${application.confirmation_code})`);

  return { success: true };
}

// 문자7(최소인원 미달 취소) — 어드민이 세션 단위로 "회차 비활성화" 버튼을
// 누르면 세션을 cancelled로 닫고, 그 세션의 confirmed/waiting 신청 전체를
// cancelled로 일괄 전환하며 각 대표 신청자에게 안내 문자를 보낸다.
export async function deactivateSession(sessionId: string) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const supabase = createAdminClient();

  const { data: session, error: sessError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  if (session.status === "cancelled") {
    return { error: "이미 비활성화된 회차입니다." };
  }

  const { data: applications, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("session_id", sessionId)
    .in("status", ["confirmed", "waiting"]);

  if (appsError) {
    return { error: "신청 목록을 불러올 수 없습니다: " + appsError.message };
  }

  const { error: sessionUpdateError } = await supabase
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);

  if (sessionUpdateError) {
    return { error: "세션 비활성화 실패: " + sessionUpdateError.message };
  }

  const errors: string[] = [];
  let successCount = 0;

  for (const application of applications ?? []) {
    try {
      const representative = await getRepresentative(supabase, application.id);
      const attendeeCount = await getAttendeeCount(supabase, application.id);

      await supabase
        .from("applications")
        .update({ status: "cancelled", payment_status: "cancelled" })
        .eq("id", application.id);

      if (representative) {
        await sendMinimumNotMetCancellationSms(session, application, representative, attendeeCount);
        successCount++;
      } else {
        errors.push(`신청 ${application.confirmation_code}: 대표 신청자 연락처 없음`);
      }
    } catch (err) {
      errors.push(`신청 ${application.confirmation_code}: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  }

  console.log(`[admin] 회차 비활성화됨: ${sessionId} (신청 ${successCount}건 취소+안내)`);

  return { success: true, count: successCount, total: applications?.length ?? 0, errors: errors.length > 0 ? errors : undefined };
}

// 문자3(전날안내) — 외부 크론 없이도 운영자가 원하는 시점에 수동으로 발송할 수
// 있도록 세션 단위 버튼. /api/cron/reminder와 동일한 발송 로직을 공유한다.
export async function sendSessionReminderAdmin(
  sessionId: string
): Promise<{ error: string } | { success: true; count: number; total: number; errors?: string[] }> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const supabase = createAdminClient();

  const { data: session, error: sessError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const result = await sendSessionReminders(supabase, session);

  console.log(`[admin] 전날안내 문자 수동 발송됨: ${sessionId} (${result.count}/${result.total}건)`);

  return { success: true, ...result };
}
