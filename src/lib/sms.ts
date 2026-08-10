import "server-only";
import { SolapiMessageService } from "solapi";
import type { Application, Session } from "@/types/domain";
import type { AttendeeInput } from "@/app/sessions/[id]/apply/actions";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { formatKrw } from "@/lib/format";

function phoneDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

export async function sendApplicationConfirmationSms({
  session,
  application,
  attendees,
}: {
  session: Session;
  application: Application;
  attendees: AttendeeInput[];
}): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  if (!apiKey || !apiSecret || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 신청확인 문자를 건너뜁니다.");
    return;
  }

  const representative = attendees[0];
  if (!representative) return;

  const statusLine =
    application.status === "confirmed"
      ? "상태: 참가확정"
      : "상태: 참가대기(정원이 차면 자동으로 확정될 수 있어요)";

  const text = [
    `[우주이스케이프] ${session.title} 신청이 접수됐어요.`,
    `접수번호: ${application.confirmation_code}`,
    statusLine,
    `입금액: ${formatKrw(session.price_krw)}`,
    `계좌: ${BANK_ACCOUNT.bankName} ${BANK_ACCOUNT.accountNumber} (예금주 ${BANK_ACCOUNT.accountHolder})`,
    "행사 전날부터는 환불이 불가해요.",
  ].join("\n");

  try {
    const messageService = new SolapiMessageService(apiKey, apiSecret);
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representative.phone),
      text,
    });
  } catch (err) {
    console.error("[sms] 신청확인 문자 발송 중 에러", err);
  }
}
