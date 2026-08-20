import "server-only";
import { SolapiMessageService } from "solapi";
import type { Application, Session } from "@/types/domain";
import type { AttendeeInput } from "@/app/(site)/sessions/[slug]/apply/actions";
import { BANK_ACCOUNT } from "@/lib/bankAccount";
import { formatKrw, formatSessionDate, formatSessionTime, formatDuration } from "@/lib/format";
import { isDatingTheme } from "@/lib/theme";
import { createAdminClient } from "@/lib/supabase/admin";

// sms_templates 테이블이 비어있거나 조회 실패 시 쓰는 폴백 — 운영 SMS 발송이
// DB 조회 실패로 끊기면 안 되므로 필수. supabase-schema.sql의 최신 시드/업데이트
// 값(v29 기준)과 반드시 동일하게 유지할 것 — 어드민 페이지에서 body를 수정하면
// 이 값과 다시 어긋나므로, 어드민 수정 시 이 파일과 schema.sql도 같이 동기화한다.
const DEFAULT_TEMPLATES: Record<string, string> = {
  application_confirmation: `[우주이스케이프] 신청 접수 안내문자입니다.

{{name}}님, 신청이 접수되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: [프리오픈] {{theme_name}} ({{product_label}})
· 날짜: {{event_date}}
· 시간: {{start_time}}
· 인원: {{attendee_count}}명

· 입금자명: {{depositor_name}}
· 입금액: {{price}}
· 입금계좌: {{bank_name}} {{account_number}} (예금주 {{account_holder}})

계좌이체 시 입금확인 후 참여 확정 문자가 발송됩니다.
참여신청 후 30분 이내에 입금이 확인되지 않을 경우 신청이 취소될 수 있습니다.

문의: 카카오톡 채널 우주이스케이프`,

  payment_confirmed: `[우주이스케이프] 참여 확정 안내문자입니다.

{{name}}님, 입금이 확인되어 참여가 확정되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: [프리오픈] {{theme_name}} ({{product_label}})
· 날짜: {{event_date}}
· 시간: {{start_time}}
· 인원: {{attendee_count}}명

상세 장소는 체험 전날 다시 안내드립니다.

신청 조회·취소는 아래에서 가능합니다.
www.wouldyouescape.com/lookup

[환불 규정]
· 48시간 전 취소: 전액 환불
· 24시간 전 취소: 50% 환불
· 24시간 이내 취소: 환불불가

문의: 카카오톡 채널 우주이스케이프`,

  event_reminder_group: `[우주이스케이프] 참여 하루 전 안내문자입니다.

{{name}}님, 내일 진행되는 테마 안내드립니다.
· 테마: [프리오픈] {{theme_name}} ({{product_label}})
· 일시: {{event_date}} {{start_time}} (10분 전까지 도착)
· 장소: 서울특별시 관악구 봉천로 333 지하 뮤트스페이스 더클래식 봉천점 1층
· 주차: 인근 유료주차장 또는 노상공영주차장을 이용해 주세요.
· 준비물: 신분증 (또는 운전면허증, 모바일 신분증 등)

[꼭 확인해 주세요]
· 만 19세 이상만 참가 가능하며 현장에서 신분증을 확인합니다. 미지참 시 참가가 제한됩니다.
· 음주 시 입장이 불가능하며, 이로 인한 입장제한 시 환불이 불가능합니다.
· 방탈출 특성상 1부 진행 중에는 휴대폰을 보관하며, 1부 콘텐츠가 회수되는 시점에 돌려드립니다.
· 동행자가 있으시다면 위 내용을 함께 전달해 주세요.

[참석이 어려우시다면]
대기하고 계신 분들을 위해 미리 취소해 주시기 바랍니다. 취소 신청 없이 당일 참석하지 않으시면 이후 이용이 제한될 수 있습니다. (24시간 이내 취소 환불불가)
취소: www.wouldyouescape.com/lookup

문의: 카카오톡 채널 우주이스케이프`,

  event_reminder_dating: `[우주이스케이프] 참여 하루 전 안내문자입니다.

{{name}}님, 내일 진행되는 테마 안내드립니다.
· 테마: [프리오픈] {{theme_name}} ({{product_label}})
· 일시: {{event_date}} {{start_time}} (10분 전까지 도착)
· 장소: 서울특별시 관악구 봉천로 333 지하 뮤트스페이스 더클래식 봉천점 1층
· 주차: 인근 유료주차장 또는 노상공영주차장을 이용해 주세요.
· 준비물: 신분증 (또는 운전면허증, 모바일 신분증 등)

[꼭 확인해 주세요]
· 만 19세 이상만 참가 가능하며 현장에서 신분증을 확인합니다. 미지참 시 참가가 제한됩니다.
· 음주 시 입장이 불가능하며, 이로 인한 입장제한 시 환불이 불가능합니다.
· 방탈출 특성상 1부 진행 중에는 휴대폰을 보관하며, 1부 콘텐츠가 회수되는 시점에 돌려드립니다.
· 2부부터는 음주가 가능합니다. 소주·맥주 외에 다른 주류를 원하실 경우 개인 지참(BYOB)도 가능합니다.

[참석이 어려우시다면]
대기하고 계신 분들을 위해 미리 취소해 주시기 바랍니다. 취소 신청 없이 당일 참석하지 않으시면 이후 이용이 제한될 수 있습니다. (24시간 이내 취소 환불불가)
취소: www.wouldyouescape.com/lookup

문의: 카카오톡 채널 우주이스케이프`,

  application_cancelled: `[우주이스케이프] 미입금 신청취소 안내문자입니다.

{{name}}님, 접수번호 {{confirmation_code}} 건은 입금이 확인되지 않아 신청이 취소되었습니다.

다시 신청하시려면 아래에서 진행해 주세요.
{{reapply_url}}

이미 입금하셨다면 카카오톡 채널로 문의 바랍니다.

문의: 카카오톡 채널 우주이스케이프`,

  waitlist_promoted: `[우주이스케이프] 공석신청 입금 안내문자입니다.

{{name}}님, 유선 상 안내드린 대로 아래 테마 참여가 가능합니다.
· 접수번호: {{confirmation_code}}
· 테마: [프리오픈] {{theme_name}} ({{product_label}})
· 날짜: {{event_date}}
· 시간: {{start_time}}
· 인원: {{attendee_count}}명

· 입금자명: {{depositor_name}}
· 입금액: {{price}}
· 입금계좌: {{bank_name}} {{account_number}} (예금주 {{account_holder}})
· 입금기한: 문자 수신 후 24시간 이내

기한 내 입금이 확인되지 않으면 다음 대기자에게 자리가 넘어갑니다.

문의: 카카오톡 채널 우주이스케이프`,

  minimum_not_met_cancellation: `[우주이스케이프] 인원미달 취소 안내문자입니다.

{{name}}님, 신청하신 테마가 최소 진행 인원에 미달하여 부득이하게 취소되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: [프리오픈] {{theme_name}} ({{product_label}})
· 일시: {{event_date}} {{start_time}}

결제하신 {{refund_amount}}은 전액 환불되며, 영업일 기준 3~5일 이내 입금하신 계좌로 처리됩니다.

일정을 비워두셨을 텐데 불편을 드려 죄송합니다.

문의: 카카오톡 채널 우주이스케이프`,
};

async function getTemplateBody(key: string): Promise<string> {
  const fallback = DEFAULT_TEMPLATES[key];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("sms_templates").select("body").eq("key", key).single();
    return data?.body || fallback;
  } catch {
    return fallback;
  }
}

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

function themeName(session: Session): string {
  return session.theme_name;
}

function productLabel(session: Session): string {
  return `${session.session_type} 파티형 방탈출`;
}

// SMS는 신청자 본인에게만 가는 채널이라 BANK_ACCOUNT(화면 표시용, 마스킹됨)와
// 별개로 마스킹 안 된 값을 쓴다.
const BANK_ACCOUNT_NUMBER_SMS = "3333-05-2843942";
const BANK_ACCOUNT_HOLDER_SMS = "김시온";

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
  const body = await getTemplateBody("application_confirmation");
  const text = renderTemplate(body, {
    name: representative.name,
    theme_name: themeName(session),
    product_label: productLabel(session),
    event_date: formatSessionDate(session.event_date),
    start_time: formatSessionTime(session.start_at),
    end_time: endTime,
    duration: durationLabel(session),
    attendee_count: String(attendees.length),
    confirmation_code: application.confirmation_code,
    price: formatKrw(session.price_krw),
    bank_name: BANK_ACCOUNT.bankName,
    account_number: BANK_ACCOUNT_NUMBER_SMS,
    account_holder: BANK_ACCOUNT_HOLDER_SMS,
    depositor_name: application.depositor_name,
  });

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
  const body = await getTemplateBody("payment_confirmed");
  const text = renderTemplate(body, {
    name: representative.name,
    theme_name: themeName(session),
    product_label: productLabel(session),
    event_date: formatSessionDate(session.event_date),
    start_time: formatSessionTime(session.start_at),
    end_time: endTime,
    duration: durationLabel(session),
    attendee_count: String(attendeeCount),
    confirmation_code: application.confirmation_code,
  });

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
  application: Pick<Application, "confirmation_code">,
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

  const addressText = venueAddress ? ` (${venueAddress})` : "";
  const dating = isDatingTheme(session.session_type);
  const templateKey = dating ? "event_reminder_dating" : "event_reminder_group";
  const body = await getTemplateBody(templateKey);
  const text = renderTemplate(body, {
    theme_name: themeName(session),
    product_label: productLabel(session),
    event_date: formatSessionDate(session.event_date),
    start_time: formatSessionTime(session.start_at),
    duration: durationLabel(session),
    venue_name: venueName,
    venue_address_text: addressText,
  });

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

  const body = await getTemplateBody("application_cancelled");
  const text = renderTemplate(body, {
    name: representative.name,
    confirmation_code: application.confirmation_code,
    reapply_url: `www.wouldyouescape.com/sessions/${session.slug}`,
  });

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
  attendeeCount: number,
  depositorName: string
): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const messageService = getSolapiMessageService();
  if (!messageService || !senderNumber) {
    console.warn("[sms] SOLAPI_* 환경변수가 설정되지 않아 공석입금안내 문자를 건너뜁니다.");
    return;
  }

  const endTime = session.end_at ? `~${formatSessionTime(session.end_at)}` : "";
  const body = await getTemplateBody("waitlist_promoted");
  const text = renderTemplate(body, {
    name: representative.name,
    theme_name: themeName(session),
    product_label: productLabel(session),
    event_date: formatSessionDate(session.event_date),
    start_time: formatSessionTime(session.start_at),
    end_time: endTime,
    duration: durationLabel(session),
    attendee_count: String(attendeeCount),
    confirmation_code: application.confirmation_code,
    price: formatKrw(session.price_krw),
    bank_name: BANK_ACCOUNT.bankName,
    account_number: BANK_ACCOUNT_NUMBER_SMS,
    account_holder: BANK_ACCOUNT_HOLDER_SMS,
    depositor_name: depositorName,
  });

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

  const body = await getTemplateBody("minimum_not_met_cancellation");
  const text = renderTemplate(body, {
    event_date: formatSessionDate(session.event_date),
    name: representative.name,
    theme_name: themeName(session),
    product_label: productLabel(session),
    start_time: formatSessionTime(session.start_at),
    refund_amount: formatKrw(session.price_krw * attendeeCount),
  });

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
