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
    .eq("payment_status", "confirmed");

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

  // ⚠️ 발송 쪽(sendSessionReminders)과 **같은 조건**이어야 한다. 미리보기에 뜬
  //    사람과 실제로 문자를 받는 사람이 다르면 미리보기가 의미를 잃는다.
  //    대표뿐 아니라 동행자까지, 아직 안내를 못 받은 참여자 전원이 대상이다.
  const { data: attendees } = await supabase
    .from("admin_attendee_view")
    .select("id, application_id, name, phone")
    .in("application_id", applications.map((a) => a.id))
    .is("reminder_sms_sent_at", null);

  const codeByApp = new Map(applications.map((a) => [a.id, a.confirmation_code as string]));

  for (const at of attendees ?? []) {
    const code = codeByApp.get(at.application_id as string) ?? "";
    if (!at.phone || !at.name) {
      skipped.push(`신청 ${code}: 참여자 연락처 없음`);
      continue;
    }
    recipients.push({
      name: at.name as string,
      phone: at.phone as string,
      confirmationCode: code,
    });
  }

  return {
    total: recipients.length + skipped.length,
    recipients,
    messagePreview,
    skipped: skipped.length > 0 ? skipped : undefined,
  };
}

// 크론(/api/cron/reminder)과 어드민 "장소안내 발송" 버튼이 공유하는 발송 로직 —
// 세션 하나를 받아 확정+입금확인된 신청의 **참여자 전원** 중 아직 안내를 못
// 받은 사람에게 발송한다.
//
// ⚠️ 대표 한 명이 아니라 동행자까지 모두 보낸다. 장소는 당일 필수 정보라
//    대표가 전달해 주기를 기대하면 안 된다는 판단이다(2026-09-12 결정).
//    발송 표시도 참여자 단위(application_attendees.reminder_sms_sent_at)로
//    남긴다 — 신청 단위로 두면 4명 중 1명만 실패했을 때 그 사람을 영영 못
//    보내거나 4명 전원에게 다시 보내게 된다. 배경은 마이그레이션 p16 참고.
export async function sendSessionReminders(
  supabase: SupabaseClient,
  session: Session
): Promise<{ count: number; total: number; errors?: string[] }> {
  const { data: applications, error: appsError } = await supabase
    .from("applications")
    .select("id, session_id, confirmation_code, status, payment_status")
    .eq("session_id", session.id)
    .eq("status", "confirmed")
    .eq("payment_status", "confirmed");

  if (appsError || !applications || applications.length === 0) {
    return { count: 0, total: 0 };
  }

  // 아직 안내를 못 받은 참여자만 고른다(취소·미입금 신청은 위에서 이미 빠졌다).
  const { data: attendees, error: attErr } = await supabase
    .from("admin_attendee_view")
    .select("id, application_id, name, phone")
    .in("application_id", applications.map((a) => a.id))
    .is("reminder_sms_sent_at", null);

  if (attErr || !attendees || attendees.length === 0) {
    return { count: 0, total: 0, errors: attErr ? [attErr.message] : undefined };
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
  const codeByApp = new Map(applications.map((a) => [a.id, a.confirmation_code as string]));
  const label = (appId: string, name?: string) =>
    `${codeByApp.get(appId) ?? appId}${name ? ` ${name}님` : ""}`;

  // 문구는 사람마다 이름만 다르다. 먼저 전부 만들어 두고 한 번에 보낸다.
  const messages: BulkMessage[] = [];
  for (const at of attendees) {
    const appId = at.application_id as string;
    if (!at.phone || !at.name) {
      errors.push(`신청 ${label(appId)}: 참여자 연락처 없음`);
      continue;
    }
    try {
      const text = sdSend
        ? await buildEventReminderTextV2(
            sdSend,
            at.name as string,
            sdSend.venue_address ?? null,
            sdSend.venue_parking_note ?? null
          )
        : await buildEventReminderText(session, at.name as string, venueName, venue?.venue_address ?? null);
      messages.push({ key: at.id as string, to: at.phone as string, text });
    } catch (err) {
      errors.push(
        `신청 ${label(appId, at.name as string)}: ${err instanceof Error ? err.message : "문구 생성 실패"}`
      );
    }
  }

  // 솔라피 한 번의 요청으로 전원에게 보낸다.
  const { sentKeys, failures } = await sendSmsBulk(messages, "장소안내 문자");

  const byAttendeeId = new Map(attendees.map((a) => [a.id as string, a]));
  for (const f of failures) {
    const at = byAttendeeId.get(f.key);
    errors.push(
      `신청 ${at ? label(at.application_id as string, at.name as string) : f.key}: ${f.reason}`
    );
  }

  // ⚠️ 실제로 접수된 사람만 발송 표시를 남긴다. 실패한 사람은 표시가 없으므로
  //    다음 실행이 **그 사람만** 다시 시도한다.
  //    service_role 은 application_attendees 에 테이블 권한이 없어(의도된 잠금)
  //    SECURITY DEFINER 함수를 통해 표시한다.
  if (sentKeys.length > 0) {
    const { error: markError } = await supabase.rpc("mark_attendee_reminder_sent", {
      p_attendee_ids: sentKeys,
    });
    if (markError) {
      // 문자는 이미 나갔는데 표시를 못 남긴 상태다. 다음 실행이 중복 발송할 수
      // 있으므로 반드시 눈에 띄게 남긴다.
      console.error("[reminderSms] 발송 표시 실패 — 중복 발송 위험", markError, sentKeys);
      errors.push(`발송 표시 실패(중복 발송 위험): ${markError.message}`);
    } else {
      // 어드민 목록이 신청 단위로 '안내 발송됨' 을 보여주므로, 그 신청의
      // 참여자가 전원 발송된 경우에만 신청 쪽 표시도 같이 남긴다.
      const remaining = new Map<string, number>();
      for (const at of attendees) {
        const appId = at.application_id as string;
        remaining.set(appId, (remaining.get(appId) ?? 0) + 1);
      }
      for (const key of sentKeys) {
        const appId = byAttendeeId.get(key)?.application_id as string | undefined;
        if (appId) remaining.set(appId, (remaining.get(appId) ?? 0) - 1);
      }
      const doneApps = [...remaining.entries()].filter(([, left]) => left === 0).map(([id]) => id);
      if (doneApps.length > 0) {
        await supabase
          .from("applications")
          .update({ reminder_sms_sent_at: new Date().toISOString() })
          .in("id", doneApps)
          .is("reminder_sms_sent_at", null);
      }
    }
  }

  return {
    count: sentKeys.length,
    total: messages.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}
