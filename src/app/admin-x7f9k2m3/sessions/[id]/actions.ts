"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentConfirmedSms } from "@/lib/sms";
import { requireAdminAuth } from "@/lib/adminAuth";

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

  const { data: session, error: sessError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const { data: representative, error: attError } = await supabase
    .from("admin_attendee_view")
    .select("phone")
    .eq("application_id", applicationId)
    .eq("is_representative", true)
    .single();

  if (attError || !representative?.phone) {
    return { error: "대표 신청자를 찾을 수 없습니다." };
  }

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

  await sendPaymentConfirmedSms(session, application, representative.phone);

  console.log(`[admin] 입금 확인됨: ${applicationId} (${application.confirmation_code})`);

  return { success: true };
}
