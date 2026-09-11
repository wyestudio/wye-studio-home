import "server-only";
import { SolapiMessageService } from "solapi";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw, formatDuration } from "@/lib/format";
import { BANK_ACCOUNT } from "@/lib/bankAccount";

/**
 * 테마·회차 구조용 문자 발송.
 *
 * 기존 src/lib/sms.ts 는 옛 Session 타입(session_type 분기, 단일가)에 묶여
 * 있어 새 흐름에 쓸 수 없다. 옛 화면이 아직 그걸 쓰므로 건드리지 않고
 * 새 파일로 분리한다 (Expand 원칙 — 둘이 공존해야 롤백이 쉽다).
 *
 * 템플릿은 sms_templates 의 *_v2 키를 쓴다. 운영자가 어드민에서 문구를
 * 고칠 수 있어야 하므로 코드에 본문을 두지 않는다(폴백만 최소한으로).
 */

// SMS 는 신청자 본인에게만 가는 채널이라 화면 표시용(마스킹된) 값과 별개로
// 마스킹하지 않은 계좌 정보를 쓴다.
const BANK_ACCOUNT_NUMBER_SMS = "3333-05-2843942";
const BANK_ACCOUNT_HOLDER_SMS = "김시온";

export type SmsSessionInfo = {
  themeName: string;
  startAt: string;
  endAt: string | null;
  minAge: number;
};

function kst(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...opts }).format(new Date(iso));
}

const eventDate = (iso: string) =>
  kst(iso, { month: "long", day: "numeric", weekday: "short" });
const startTime = (iso: string) =>
  kst(iso, { hour: "2-digit", minute: "2-digit", hour12: false });

function durationLabel(s: SmsSessionInfo): string {
  return s.endAt ? formatDuration(s.startAt, s.endAt) : "-";
}

/** 템플릿 본문을 DB 에서 읽는다. 실패해도 발송 자체를 막지 않도록 폴백을 둔다. */
async function getTemplateBody(key: string, fallback: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("sms_templates").select("body").eq("key", key).single();
    return data?.body || fallback;
  } catch {
    return fallback;
  }
}

function render(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function getService() {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return new SolapiMessageService(apiKey, apiSecret);
}

const FALLBACK_CONFIRMATION = `[우주이스케이프] 신청이 접수되었습니다.

{{name}}님, 신청이 접수되었습니다.
· 접수번호: {{confirmation_code}}
· 테마: {{theme_name}}
· 일시: {{event_date}} {{start_time}}
· 인원: {{attendee_count}}명
· 입금액: {{price}}
· 입금자명: {{depositor_name}}
· 입금계좌: {{bank_name}} {{account_number}} (예금주 {{account_holder}})

※ 입금자명이 다르면 자동 확인이 되지 않습니다.
문의: 카카오톡 채널 우주이스케이프`;

/**
 * 문자1 — 신청확인.
 *
 * ⚠️ 발송 실패가 신청 자체를 실패시키면 안 된다. 고객은 이미 신청을 마쳤고
 *    DB 에도 저장됐다. 실패는 로그만 남기고 삼킨다.
 */
export async function sendApplicationConfirmationSmsV2(params: {
  session: SmsSessionInfo;
  to: string;
  recipientName: string;
  confirmationCode: string;
  headcount: number;
  amountKrw: number;
  depositorName: string;
}): Promise<void> {
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const service = getService();
  if (!service || !senderNumber) {
    console.warn("[smsV2] SOLAPI_* 미설정 — 신청확인 문자를 건너뜁니다.");
    return;
  }

  const { session } = params;
  const body = await getTemplateBody("application_confirmation_v2", FALLBACK_CONFIRMATION);

  const text = render(body, {
    name: params.recipientName,
    theme_name: session.themeName,
    event_date: eventDate(session.startAt),
    start_time: startTime(session.startAt),
    duration: durationLabel(session),
    attendee_count: String(params.headcount),
    confirmation_code: params.confirmationCode,
    price: formatKrw(params.amountKrw),
    bank_name: BANK_ACCOUNT.bankName,
    account_number: BANK_ACCOUNT_NUMBER_SMS,
    account_holder: BANK_ACCOUNT_HOLDER_SMS,
    depositor_name: params.depositorName,
    min_age: String(session.minAge),
  });

  try {
    await service.send({ from: senderNumber, to: params.to.replace(/\D/g, ""), text });
    console.log(`[smsV2] 신청확인 문자 발송 완료: ${params.confirmationCode}`);
  } catch (err) {
    // 신청은 이미 성공했다. 문자 실패로 사용자에게 에러를 보이면 안 된다.
    console.error("[smsV2] 신청확인 문자 발송 실패", err);
  }
}
