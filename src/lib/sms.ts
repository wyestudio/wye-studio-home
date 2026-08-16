import "server-only";
import { SolapiMessageService } from "solapi";
import type { Application, Session } from "@/types/domain";
import type { AttendeeInput } from "@/app/sessions/[slug]/apply/actions";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { formatKrw, formatSessionDate, formatSessionTime, formatDuration } from "@/lib/format";
import { isDatingTheme } from "@/lib/theme";

function themeName(session: Session): string {
  return session.theme_name;
}

function productLabel(session: Session): string {
  return `${session.session_type} 버전`;
}

// 그룹 3시간 30분 / 소개팅 4시간 30분(WYE-73 5장 치환값 기준). end_at이 있으면
// 실제 시각 차이를 우선한다 — 향후 회차 시간이 바뀌어도 하드코딩값과 어긋나지 않도록.
function durationLabel(session: Session): string {
  if (session.end_at) return formatDuration(session.start_at, session.end_at);
  return isDatingTheme(session.session_type) ? "4시간 30분" : "3시간 30분";
}

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

  const endTime = session.end_at ? `~${formatSessionTime(session.end_at)}` : "";
  const text = [
    "[우주이스케이프] 신청 접수 완료",
    "",
    `${representative.name}님, 신청이 접수되었습니다.`,
    `· 체험: ${themeName(session)} 방탈출 베타테스터 (${productLabel(session)})`,
    `· 일시: ${formatSessionDate(session.event_date)} ${formatSessionTime(session.start_at)}${endTime} (${durationLabel(session)} 소요)`,
    `· 인원: ${attendees.length}명`,
    `· 접수번호: ${application.confirmation_code}`,
    `· 입금액: ${formatKrw(session.price_krw)}`,
    `· 입금계좌: ${BANK_ACCOUNT.bankName} 3333-05-2843942 (예금주 김시온)`,
    "",
    "30분 내 입금이 확인되지 않으면 예약이 취소될 수 있습니다. 입금자명은 신청자 성함으로 부탁드립니다.",
    "",
    "[환불 규정]",
    "체험 시작 48시간 전까지 100% / 24시간 전까지 50% / 이후 환불 불가",
    "",
    "문의: 카카오톡 채널 우주이스케이프",
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
  representative: { name: string; phone: string },
  attendeeCount: number
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 입금확인 문자를 건너뜁니다.");
    return;
  }

  const endTime = session.end_at ? `~${formatSessionTime(session.end_at)}` : "";
  const text = [
    "[우주이스케이프] 예약이 확정되었습니다",
    "",
    `${representative.name}님, 입금이 확인되어 예약이 확정되었습니다.`,
    `· 체험: ${themeName(session)} 방탈출 베타테스터 (${productLabel(session)})`,
    `· 일시: ${formatSessionDate(session.event_date)} ${formatSessionTime(session.start_at)}${endTime} (${durationLabel(session)} 소요)`,
    `· 인원: ${attendeeCount}명`,
    `· 접수번호: ${application.confirmation_code}`,
    "",
    "상세 장소와 준비물은 체험 전날 다시 안내드립니다.",
    "예약 조회·취소는 아래에서 가능합니다.",
    "www.wouldyouescape.com/lookup",
    "",
    "문의: 카카오톡 채널 우주이스케이프",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representative.phone),
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
  venueName: string,
  venueAddress: string | null
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 전날안내 문자를 건너뜁니다.");
    return;
  }

  const eventDateStr = formatSessionDate(session.event_date);
  const startTimeStr = formatSessionTime(session.start_at);
  const addressText = venueAddress ? ` (${venueAddress})` : "";
  const dating = isDatingTheme(session.session_type);

  const bullets = [
    "만 19세 이상만 참가 가능하며 현장에서 신분증을 확인합니다. 미지참 시 참가가 제한됩니다.",
    "입장 시 음주하신 것으로 확인되면 출입이 제한될 수 있습니다.",
    "1부 진행 중에는 휴대폰을 보관하며, 1부 콘텐츠가 회수되는 시점에 돌려드립니다.",
    ...(dating
      ? ["2부부터는 음주가 가능합니다. 소주·맥주 외에 다른 주류를 원하실 경우 개인 지참(BYOB)도 가능합니다."]
      : ["동행자가 있으시다면 위 내용을 함께 전달해 주세요."]),
  ];

  const text = [
    "[우주이스케이프] 내일 뵙겠습니다",
    "",
    `내일 진행되는 체험 안내드립니다.`,
    `· 체험: ${themeName(session)} 방탈출 베타테스터 (${productLabel(session)})`,
    `· 일시: ${eventDateStr} ${startTimeStr} (${durationLabel(session)} 소요, 10분 전까지 도착)`,
    `· 장소: ${venueName}${addressText}`,
    "· 주차: 인근 유료주차장 또는 노상공영주차장을 이용해 주세요.",
    "· 준비물: 신분증",
    "",
    "[꼭 확인해 주세요]",
    ...bullets.map((b) => `· ${b}`),
    "",
    "[참석이 어려우시다면]",
    "대기하고 계신 분들을 위해 미리 취소해 주시기 바랍니다. 취소 신청 없이 당일 참석하지 않으시면 이후 이용이 제한될 수 있습니다.",
    "취소: www.wouldyouescape.com/lookup",
    "",
    "문의: 카카오톡 채널 우주이스케이프",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representativePhone),
      text,
    });
    console.log(`[sms] 전날안내 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 전날안내 문자 발송 중 에러", err);
  }
}

export async function sendApplicationCancelledSms(
  session: Session,
  application: Application,
  representative: { name: string; phone: string }
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 미입금취소 문자를 건너뜁니다.");
    return;
  }

  const text = [
    "[우주이스케이프] 미입금으로 예약이 취소되었습니다",
    "",
    `${representative.name}님, 접수번호 ${application.confirmation_code} 건은 입금이 확인되지 않아 예약을 취소했습니다.`,
    "",
    "다시 신청하시려면 아래에서 진행해 주세요.",
    `www.wouldyouescape.com/sessions/${session.slug}`,
    "",
    "이미 입금하셨다면 카카오톡 채널로 알려주시기 바랍니다.",
    "",
    "문의: 카카오톡 채널 우주이스케이프",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representative.phone),
      text,
    });
    console.log(`[sms] 미입금취소 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 미입금취소 문자 발송 중 에러", err);
  }
}

export async function sendWaitlistPromotedSms(
  session: Session,
  application: Application,
  representative: { name: string; phone: string },
  attendeeCount: number
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 공석입금안내 문자를 건너뜁니다.");
    return;
  }

  const endTime = session.end_at ? `~${formatSessionTime(session.end_at)}` : "";
  const text = [
    "[우주이스케이프] 자리가 생겼습니다 · 입금 안내",
    "",
    `${representative.name}님, 통화드린 대로 아래 체험 참가가 가능합니다.`,
    `· 체험: ${themeName(session)} 방탈출 베타테스터 (${productLabel(session)})`,
    `· 일시: ${formatSessionDate(session.event_date)} ${formatSessionTime(session.start_at)}${endTime} (${durationLabel(session)} 소요)`,
    `· 인원: ${attendeeCount}명`,
    `· 접수번호: ${application.confirmation_code}`,
    `· 입금액: ${formatKrw(session.price_krw)}`,
    `· 입금계좌: ${BANK_ACCOUNT.bankName} 3333-05-2843942 (예금주 김시온)`,
    "· 입금기한: 문자 수신 후 24시간 이내",
    "",
    "기한 내 입금이 확인되지 않으면 다음 대기자에게 자리가 넘어갑니다.",
    "",
    "문의: 카카오톡 채널 우주이스케이프",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representative.phone),
      text,
    });
    console.log(`[sms] 공석입금안내 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 공석입금안내 문자 발송 중 에러", err);
  }
}

export async function sendMinimumNotMetCancellationSms(
  session: Session,
  application: Application,
  representative: { name: string; phone: string },
  attendeeCount: number
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 최소인원미달취소 문자를 건너뜁니다.");
    return;
  }

  const text = [
    `[우주이스케이프] ${formatSessionDate(session.event_date)} 체험 취소 안내`,
    "",
    `${representative.name}님, 아래 체험이 최소 진행 인원에 미달하여 부득이하게 취소되었습니다.`,
    `· 체험: ${themeName(session)} 방탈출 베타테스터 (${productLabel(session)})`,
    `· 일시: ${formatSessionDate(session.event_date)} ${formatSessionTime(session.start_at)}`,
    "",
    `결제하신 ${formatKrw(session.price_krw * attendeeCount)}은 전액 환불되며, 영업일 기준 3~5일 이내 입금하신 계좌로 처리됩니다.`,
    "",
    "일정을 비워두셨을 텐데 불편을 드려 죄송합니다.",
    "",
    "문의: 카카오톡 채널 우주이스케이프",
  ].join("\n");

  try {
    await messageService.send({
      from: senderNumber,
      to: phoneDigits(representative.phone),
      text,
    });
    console.log(`[sms] 최소인원미달취소 문자 발송 완료: ${application.confirmation_code}`);
  } catch (err) {
    console.error("[sms] 최소인원미달취소 문자 발송 중 에러", err);
  }
}
