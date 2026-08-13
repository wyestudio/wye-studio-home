import "server-only";
import { SolapiMessageService } from "solapi";
import type { Application, Session } from "@/types/domain";
import type { AttendeeInput } from "@/app/sessions/[slug]/apply/actions";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { formatKrw, formatDate } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

function phoneDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

function getSolapiMessageService() {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return new SolapiMessageService(apiKey, apiSecret);
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
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 신청확인 문자를 건너뜁니다.");
    return;
  }

  // 확정된 신청만 SMS 발송
  if (application.status !== "confirmed") {
    return;
  }

  const representative = attendees[0];
  if (!representative) return;

  const text = [
    `[우주이스케이프] ${session.title} 신청이 접수됐어요.`,
    `접수번호: ${application.confirmation_code}`,
    "상태: 참가확정",
    `입금액: ${formatKrw(session.price_krw)}`,
    `계좌: ${BANK_ACCOUNT.bankName} ${BANK_ACCOUNT.accountNumber} (예금주 ${BANK_ACCOUNT.accountHolder})`,
    "30분 이내 미입금 시 자동취소될 수 있습니다.",
    "행사 전날부터는 환불이 불가해요.",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representative.phone),
      text,
    });
    console.log(`[sms] 신청확인 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 신청확인 문자 발송 중 에러", err);
  }
}

export async function sendPaymentConfirmedSms(
  session: Session,
  application: Application,
  representativePhone: string
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 입금확인 문자를 건너뜁니다.");
    return;
  }

  const text = [
    `[우주이스케이프] ${session.title} 입금이 확인됐어요.`,
    `접수번호: ${application.confirmation_code}`,
    "상태: 입금확인 완료",
    "행사 당일 정확한 장소는 전날 별도 안내해드릴게요.",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representativePhone),
      text,
    });
    console.log(`[sms] 입금확인 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 입금확인 문자 발송 중 에러", err);
  }
}

export async function sendEventReminderSms(
  session: Session,
  application: Application,
  representativePhone: string,
  venueName: string
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 참가확정 문자를 건너뜁니다.");
    return;
  }

  const eventDateStr = formatDate(new Date(session.start_at));
  const text = [
    `[우주이스케이프] ${session.title}`,
    `${eventDateStr}에 행사가 있어요!`,
    `장소: ${venueName}`,
    `접수번호: ${application.confirmation_code}`,
    "현장에서 뵙겠습니다!",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representativePhone),
      text,
    });
    console.log(`[sms] 참가확정 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 참가확정 문자 발송 중 에러", err);
  }
}
