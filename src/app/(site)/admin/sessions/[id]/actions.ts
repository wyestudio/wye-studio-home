"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getSessionDisplay,
  sendPaymentConfirmedSmsV2,
  sendApplicationCancelledSmsV2,
  sendWaitlistPromotedSmsV2,
  sendSessionCancelledSmsV2,
} from "@/lib/smsV2";
import { requireAdminAuth } from "@/lib/adminAuth";
import { sendSessionReminders, getSessionReminderPreview, type ReminderPreview } from "@/lib/reminderSms";
import { isDatingTheme } from "@/lib/theme";
import { isEligibleBirthYear, eligibleBirthYearRangeLabel } from "@/lib/eligibility";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import { isValidKoreanName, isValidNickname, isValidExperienceRange, type ExperienceRange } from "@/lib/validation";
import type { Application, Gender } from "@/types/domain";

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

async function getDepositorName(supabase: ReturnType<typeof createAdminClient>, applicationId: string) {
  const { data } = await supabase
    .from("admin_application_view")
    .select("depositor_name")
    .eq("id", applicationId)
    .single();
  return (data?.depositor_name as string) ?? "";
}


/**
 * 이 회차와 관련된 화면을 다시 그리게 한다.
 *
 * ⚠️ 이게 없으면 DB 는 바뀌었는데 화면은 그대로다. 입금 확인을 눌러도 '대기중'
 *    이 남고 '입금 확인 전 인원' 도 줄지 않아, 버튼이 안 먹은 것처럼 보인다
 *    (실제로 그렇게 보고됐다). 액션 셀만 로컬 상태로 바뀌어 더 헷갈렸다.
 */
function revalidateSession(sessionId: string) {
  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin");
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

  const sd = await getSessionDisplay(session.id);
  if (sd) {
    await sendPaymentConfirmedSmsV2({
      session: sd,
      to: representative.phone,
      name: representative.name,
      confirmationCode: application.confirmation_code,
      headcount: attendeeCount,
    });
  }

  console.log(`[admin] 입금 확인됨: ${applicationId} (${application.confirmation_code})`);

  revalidateSession(sessionId);
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

  const sdCancel = await getSessionDisplay(session.id);
  if (sdCancel) {
    await sendApplicationCancelledSmsV2({
      session: sdCancel,
      to: representative.phone,
      name: representative.name,
      confirmationCode: application.confirmation_code,
    });
  }

  console.log(`[admin] 신청 취소됨(미입금): ${applicationId} (${application.confirmation_code})`);

  revalidateSession(sessionId);
  return { success: true };
}

// 어드민이 잘못 입력한 신청(수동 등록 오탈자 등)을 신청자에게 안내 문자
// 없이 취소 처리하고 싶을 때 사용. cancelApplicationAdmin과 동일하게
// status/payment_status만 cancelled로 바꾸고, SMS 발송만 생략한다.
export async function silentCancelApplicationAdmin(applicationId: string, sessionId: string) {
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

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "cancelled", payment_status: "cancelled" })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "업데이트 실패: " + updateError.message };
  }

  console.log(`[admin] 신청 무통보 취소됨: ${applicationId} (${application.confirmation_code}), 안내 문자 발송 안 함`);

  revalidateSession(sessionId);
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
  const depositorName = await getDepositorName(supabase, applicationId);

  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "confirmed", promoted_from_waiting_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "업데이트 실패: " + updateError.message };
  }

  const sdPromote = await getSessionDisplay(session.id);
  if (sdPromote) {
    // 금액은 신규 신청이면 저장된 amount_krw, 옛 신청이면 회차 단가 × 인원.
    const amount =
      (application as { amount_krw?: number | null }).amount_krw ??
      (session.price_krw ?? 0) * attendeeCount;
    await sendWaitlistPromotedSmsV2({
      session: sdPromote,
      to: representative.phone,
      name: representative.name,
      confirmationCode: application.confirmation_code,
      headcount: attendeeCount,
      amountKrw: amount,
      depositorName,
    });
  }

  console.log(`[admin] 대기자 확정 전환됨: ${applicationId} (${application.confirmation_code})`);

  revalidateSession(sessionId);
  return { success: true };
}

// 취소된 신청의 환불이 실제로 처리된 뒤 어드민이 "환불 완료" 버튼으로
// 기록만 남기는 용도. 별도 SMS는 없음(환불 안내는 취소 시점 문자4/7에 이미 포함됨).
export async function markRefundCompleted(applicationId: string, sessionId: string) {
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

  if (application.status !== "cancelled") {
    return { error: "취소된 신청만 환불 완료 처리할 수 있습니다." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ refund_completed_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "업데이트 실패: " + updateError.message };
  }

  console.log(`[admin] 환불 완료 처리됨: ${applicationId} (${application.confirmation_code})`);

  revalidateSession(sessionId);
  return { success: true };
}

// "회차 비활성화" 확인창에 실제로 취소될 신청 건수(확정/대기 구분)를 미리 보여주기 위한 조회.
export async function getDeactivatePreview(
  sessionId: string
): Promise<{ error: string } | { success: true; confirmedCount: number; waitingCount: number }> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const supabase = createAdminClient();

  const { data: applications, error } = await supabase
    .from("applications")
    .select("status")
    .eq("session_id", sessionId)
    .in("status", ["confirmed", "waiting"]);

  if (error) {
    return { error: "신청 목록을 불러올 수 없습니다: " + error.message };
  }

  const confirmedCount = (applications ?? []).filter((a) => a.status === "confirmed").length;
  const waitingCount = (applications ?? []).filter((a) => a.status === "waiting").length;

  return { success: true, confirmedCount, waitingCount };
}

// "전날안내 발송" 확인창에 실제 수신자 목록·문구를 미리 보여주기 위한 조회.
export async function getReminderPreview(
  sessionId: string
): Promise<{ error: string } | ({ success: true } & ReminderPreview)> {
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

  const preview = await getSessionReminderPreview(supabase, session);

  return { success: true, ...preview };
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

  // 회차 정보는 루프 안에서 매번 조회할 이유가 없다.
  // 조회에 실패하면 문자만 건너뛴다 — 취소 처리 자체는 계속해야 한다.
  const sdSession = await getSessionDisplay(session.id);

  for (const application of applications ?? []) {
    try {
      const representative = await getRepresentative(supabase, application.id);
      const attendeeCount = await getAttendeeCount(supabase, application.id);

      await supabase
        .from("applications")
        .update({ status: "cancelled", payment_status: "cancelled" })
        .eq("id", application.id);

      if (representative && sdSession) {
        const amount =
          (application as { amount_krw?: number | null }).amount_krw ??
          (session.price_krw ?? 0) * attendeeCount;
        await sendSessionCancelledSmsV2({
          session: sdSession,
          to: representative.phone,
          name: representative.name,
          headcount: attendeeCount,
          refundAmountKrw: amount,
          // 대기자는 대개 입금 전이다. 환불 문구를 이걸로 가른다.
          isPaid: application.payment_status === "confirmed",
        });
        successCount++;
      } else if (!sdSession) {
        errors.push(`신청 ${application.confirmation_code}: 회차 정보 조회 실패로 문자 미발송`);
      } else {
        errors.push(`신청 ${application.confirmation_code}: 대표 신청자 연락처 없음`);
      }
    } catch (err) {
      errors.push(`신청 ${application.confirmation_code}: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
  }

  console.log(`[admin] 회차 비활성화됨: ${sessionId} (신청 ${successCount}건 취소+안내)`);

  revalidateSession(sessionId);
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

export type ManualAttendeeInput = {
  name: string;
  phone: string;
  birthYear: number;
  nickname: string | null;
  gender: Gender | null;
  experienceRange: ExperienceRange | null;
};

// 어드민 수동 등록 — 유선/현장 등으로 이미 참여 의사(+입금)를 확인한 사람을
// 신청확인(문자1)/입금확인(문자6, 대기 전환 시) 문자 없이 등록하고 싶을 때 사용.
// submit_application()은 anon/authenticated에만 execute 권한이 있어(service_role
// 없음) 일반 클라이언트로 호출하고, "입금 확인 완료로 등록"을 고르면 그 뒤에
// service_role로 payment_status만 직접 confirmed로 바꾼다(이 경로엔 SMS 발송 코드가
// 없으므로 자연히 문자가 나가지 않는다). Slack 신규 신청 알림도 등록자 본인(어드민)이
// 이미 알고 있는 내용이라 의도적으로 생략한다.
export async function adminManualApply(
  sessionId: string,
  depositorName: string,
  markPaid: boolean,
  notes: string | null,
  attendees: ManualAttendeeInput[]
): Promise<{ error: string } | { success: true; confirmationCode: string; status: string }> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const adminClient = createAdminClient();

  const { data: session, error: sessError } = await adminClient
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const isDatingSession = isDatingTheme(session.session_type);

  const trimmedDepositorName = depositorName.trim();
  if (!trimmedDepositorName || !isValidKoreanName(trimmedDepositorName)) {
    return { error: "입금자명은 한글 2~10자만 가능합니다." };
  }

  if (attendees.length === 0) {
    return { error: "참여 인원을 입력해주세요." };
  }
  if (isDatingSession && attendees.length !== 1) {
    return { error: "소개팅 회차는 1인 신청만 가능합니다." };
  }

  for (const attendee of attendees) {
    if (!attendee.name.trim() || !attendee.phone.trim()) {
      return { error: "참여자 이름과 전화번호를 모두 입력해주세요." };
    }
    if (!isValidKoreanName(attendee.name)) {
      return { error: "참여자 이름은 한글 2~10자만 가능합니다." };
    }
    if (!isValidPhoneDigits(phoneDigits(attendee.phone))) {
      return { error: "올바른 휴대폰 번호 형식이 아니에요." };
    }
    if (!isEligibleBirthYear(attendee.birthYear, isDatingSession)) {
      return { error: `참여자 출생년도는 ${eligibleBirthYearRangeLabel(isDatingSession)}만 가능합니다.` };
    }
    if (!attendee.gender) {
      return { error: "모든 참여자의 성별을 선택해주세요." };
    }
    if (!attendee.experienceRange || !isValidExperienceRange(attendee.experienceRange)) {
      return { error: "모든 참여자의 방탈출 경험 횟수를 선택해주세요." };
    }
    if (attendee.nickname && !isValidNickname(attendee.nickname)) {
      return { error: "닉네임은 한글/영문 소문자/숫자 1~12자만 가능합니다." };
    }
  }

  const digitCounts = new Map<string, number>();
  for (const attendee of attendees) {
    const digits = phoneDigits(attendee.phone);
    digitCounts.set(digits, (digitCounts.get(digits) ?? 0) + 1);
  }
  if ([...digitCounts.values()].some((count) => count > 1)) {
    return { error: "그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요." };
  }

  const publicClient = await createClient();
  const { data, error } = await publicClient
    .rpc("submit_application", {
      p_session_id: sessionId,
      p_depositor_name: trimmedDepositorName,
      p_consent_required: true,
      p_consent_optional: false,
      p_attendees: attendees.map((a) => ({
        name: a.name.trim(),
        phone: a.phone.trim(),
        birth_year: a.birthYear,
        nickname: a.nickname,
        gender: a.gender,
        experience_range: a.experienceRange,
      })),
      p_notes: notes?.trim() || null,
    })
    .single();

  if (error) {
    return { error: error.message };
  }

  const application = data as Application;

  if (markPaid) {
    const { error: updateError } = await adminClient
      .from("applications")
      .update({
        payment_status: "confirmed",
        payment_confirmed_sms_sent_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (updateError) {
      return { error: `신청은 등록됐지만 입금 상태 반영에 실패했습니다: ${updateError.message}` };
    }
  }

  console.log(`[admin] 수동 등록됨: ${application.id} (${application.confirmation_code}), 안내 문자 발송 안 함`);

  revalidateSession(sessionId);
  return { success: true, confirmationCode: application.confirmation_code, status: application.status };
}

export type EditAttendeeInput = {
  id: string;
  name: string;
  phone: string;
  birthYear: number;
  nickname: string | null;
  gender: Gender | null;
  experienceRange: ExperienceRange | null;
};

// 어드민이 신청/참여자 정보를 잘못 입력한 경우 안내 문자 없이 고치는 용도.
// application_attendees는 grant가 전혀 없어 service_role도 REST로 직접
// update할 수 없어서(applications와 달리 select/update grant가 없음),
// SECURITY DEFINER 함수 admin_update_application()을 통해서만 수정한다.
// 출생년도/성별을 바꿔도 확정/대기 판정은 재계산하지 않는다(v12부터의
// 방침과 동일 — 자동 승격 없음).
export async function adminUpdateApplication(
  applicationId: string,
  sessionId: string,
  depositorName: string,
  notes: string | null,
  attendees: EditAttendeeInput[]
): Promise<{ error: string } | { success: true }> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;
  await requireAdminAuth(adminCookie);

  const adminClient = createAdminClient();

  const { data: session, error: sessError } = await adminClient
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "세션 정보를 찾을 수 없습니다." };
  }

  const isDatingSession = isDatingTheme(session.session_type);

  const trimmedDepositorName = depositorName.trim();
  if (!trimmedDepositorName || !isValidKoreanName(trimmedDepositorName)) {
    return { error: "입금자명은 한글 2~10자만 가능합니다." };
  }

  if (attendees.length === 0) {
    return { error: "참여 인원 정보가 없습니다." };
  }

  for (const attendee of attendees) {
    if (!attendee.name.trim() || !attendee.phone.trim()) {
      return { error: "참여자 이름과 전화번호를 모두 입력해주세요." };
    }
    if (!isValidKoreanName(attendee.name)) {
      return { error: "참여자 이름은 한글 2~10자만 가능합니다." };
    }
    if (!isValidPhoneDigits(phoneDigits(attendee.phone))) {
      return { error: "올바른 휴대폰 번호 형식이 아니에요." };
    }
    if (!isEligibleBirthYear(attendee.birthYear, isDatingSession)) {
      return { error: `참여자 출생년도는 ${eligibleBirthYearRangeLabel(isDatingSession)}만 가능합니다.` };
    }
    if (!attendee.gender) {
      return { error: "모든 참여자의 성별을 선택해주세요." };
    }
    if (!attendee.experienceRange || !isValidExperienceRange(attendee.experienceRange)) {
      return { error: "모든 참여자의 방탈출 경험 횟수를 선택해주세요." };
    }
    if (attendee.nickname && !isValidNickname(attendee.nickname)) {
      return { error: "닉네임은 한글/영문 소문자/숫자 1~12자만 가능합니다." };
    }
  }

  const digitCounts = new Map<string, number>();
  for (const attendee of attendees) {
    const digits = phoneDigits(attendee.phone);
    digitCounts.set(digits, (digitCounts.get(digits) ?? 0) + 1);
  }
  if ([...digitCounts.values()].some((count) => count > 1)) {
    return { error: "그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요." };
  }

  const { error } = await adminClient.rpc("admin_update_application", {
    p_application_id: applicationId,
    p_depositor_name: trimmedDepositorName,
    p_notes: attendees.length >= 2 ? notes : null,
    p_attendees: attendees.map((a) => ({
      id: a.id,
      name: a.name.trim(),
      phone: a.phone.trim(),
      birth_year: a.birthYear,
      nickname: a.nickname,
      gender: a.gender,
      experience_range: a.experienceRange,
    })),
  });

  if (error) {
    return { error: error.message };
  }

  console.log(`[admin] 신청 정보 수정됨: ${applicationId}, 안내 문자 발송 안 함`);

  revalidateSession(sessionId);
  return { success: true };
}
