import "server-only";
import type { Application, Session, ApplicationAttendee } from "@/types/domain";
import type { AttendeeInput } from "@/app/(site)/sessions/[slug]/apply/actions";
import { formatSessionDateTime, formatKrw } from "@/lib/format";

const STATUS_LABEL: Record<Application["status"], string> = {
  confirmed: "확정",
  waiting: "대기",
  cancelled: "취소",
};

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
  const attendeeLines = attendees
    .map((a, i) => `${i === 0 ? "대표" : "동행"} ${a.name} (${a.phone})`)
    .join("\n");

  const prefix = isTest ? "[테스트] " : "";
  const text = [
    `${prefix}📥 새 신청 — ${session.title}`,
    `일시: ${formatSessionDateTime(session.start_at)}`,
    `상태: ${STATUS_LABEL[application.status]} · 인원 ${attendees.length}명`,
    `대표 신청자: ${representative?.name ?? "-"} (${representative?.phone ?? "-"})`,
    `입금자명: ${application.depositor_name}`,
    `접수번호: ${application.confirmation_code}`,
    "",
    attendeeLines,
  ].join("\n");

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
