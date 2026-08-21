import "server-only";
import type { Application, Session, ApplicationAttendee } from "@/types/domain";
import type { AttendeeInput } from "@/app/(site)/sessions/[slug]/apply/actions";
import { formatKrw, formatDateTimeDotted } from "@/lib/format";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import { getSessionStats } from "@/lib/sessions";
import { createClient } from "@/lib/supabase/server";

const GENDER_LABEL: Record<"M" | "F", string> = { M: "남", F: "여" };
const SESSION_TYPE_ORDER = ["그룹", "소개팅"];

export async function sendApplicationSlackAlert({
  session,
  application,
  attendees,
  isTest = false,
}: {
  session: Session;
  application: Application;
  attendees: AttendeeInput[];
  isTest?: boolean;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_WEBHOOK_URL이 설정되지 않아 알림을 건너뜁니다.");
    return;
  }

  const representative = attendees[0];
  const deadline = new Date(new Date(application.created_at).getTime() + 30 * 60 * 1000).toISOString();

  const prefix = isTest ? "[테스트] " : "";
  const lines = [
    `${prefix}📥 새신청 - [${session.session_type} 방탈출]`,
    `접수번호: ${application.confirmation_code}`,
    `신청자명: ${representative?.name ?? "-"}${representative?.nickname ? ` (${representative.nickname})` : ""}`,
    `출생년도: ${representative?.birthYear ?? "-"}년`,
    `성별: ${representative?.gender ? GENDER_LABEL[representative.gender] : "-"}`,
    `방탈출 횟수: ${representative?.experienceRange ? EXPERIENCE_RANGE_LABELS[representative.experienceRange] : "-"}`,
    `인원: ${attendees.length}명`,
    "",
    `입금자명: ${application.depositor_name}`,
    `입금액: ${formatKrw(session.price_krw * attendees.length)}`,
    `신청일시: ${formatDateTimeDotted(application.created_at)}`,
    `입금기한: ${formatDateTimeDotted(deadline)}`,
  ];

  try {
    const headcountLines = await buildCurrentHeadcountLines(session);
    if (headcountLines.length > 0) {
      lines.push("", "[현재 신청 인원]", ...headcountLines);
    }
  } catch (err) {
    console.error("[slack] 인원 현황 조회 실패", err);
  }

  const text = lines.join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] 알림 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] 알림 전송 중 에러", err);
  }
}

// 같은 컨텐츠 그룹(현재 베타는 그룹 회차 1개 + 소개팅 회차 1개)에 속한 세션들의
// 확정/대기 인원을 세션 타입별로 합산해 "그룹 확정: 남 8 · 여 15 / 대기: ..." 줄로 만든다.
async function buildCurrentHeadcountLines(session: Session): Promise<string[]> {
  const supabase = await createClient();
  const { data: siblingSessions, error } = await supabase
    .from("sessions")
    .select("id, session_type")
    .eq("content_group", session.content_group)
    .neq("status", "cancelled");

  if (error || !siblingSessions) return [];

  const totals = new Map<string, { mc: number; fc: number; mw: number; fw: number }>();
  for (const s of siblingSessions) {
    const stats = await getSessionStats(s.id);
    const acc = totals.get(s.session_type) ?? { mc: 0, fc: 0, mw: 0, fw: 0 };
    acc.mc += stats.male_confirmed_count;
    acc.fc += stats.female_confirmed_count;
    acc.mw += stats.male_waiting_count;
    acc.fw += stats.female_waiting_count;
    totals.set(s.session_type, acc);
  }

  return SESSION_TYPE_ORDER.filter((type) => totals.has(type)).map((type) => {
    const t = totals.get(type)!;
    return `${type} 확정: 남 ${t.mc} · 여 ${t.fc} / 대기: 남 ${t.mw} · 여 ${t.fw}`;
  });
}

export async function sendCancellationSlackAlert({
  sessionTitle,
  confirmationCode,
  representative,
  refundAmount,
  refundBankName,
  refundAccountNumber,
  refundAccountHolder,
}: {
  sessionTitle: string;
  confirmationCode: string;
  representative: ApplicationAttendee;
  refundAmount: number;
  refundBankName?: string;
  refundAccountNumber?: string;
  refundAccountHolder?: string;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_REFUND_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_REFUND_WEBHOOK_URL이 설정되지 않아 환불 알림을 건너뜁니다.");
    return;
  }

  const textLines = [
    `💰 환불 필요 — ${sessionTitle}`,
    `접수번호: ${confirmationCode}`,
    `신청자: ${representative.name} (${representative.phone})`,
    "",
    "💳 환불 금액 및 계좌",
    `금액: ${formatKrw(refundAmount)}`,
  ];

  if (refundBankName && refundAccountNumber && refundAccountHolder) {
    textLines.push(`은행: ${refundBankName}`);
    textLines.push(`계좌: ${refundAccountNumber}`);
    textLines.push(`예금주: ${refundAccountHolder}`);
  }

  const text = textLines.join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] 환불 알림 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] 환불 알림 전송 중 에러", err);
  }
}
