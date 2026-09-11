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

// ─────────────────────────────────────────────────────────────────
// 어드민 액션용 (문자2·4·6·7)
//
// 어드민은 옛 회차와 새 회차를 모두 다룬다. 표시값은 session_display 뷰가
// 통일해준다(session_view 는 themes 와 INNER JOIN 이라 옛 회차가 빠진다).
// ─────────────────────────────────────────────────────────────────

export type SessionDisplay = {
  id: string;
  theme_name: string | null;
  start_at: string;
  end_at: string | null;
  min_age: number | null;
  public_path: string | null;
  venue_address: string | null;
  venue_parking_note: string | null;
};

/** 회차 표시 정보. 옛 회차·새 회차 모두 같은 모양으로 온다. */
export async function getSessionDisplay(sessionId: string): Promise<SessionDisplay | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("session_display")
    .select("id, theme_name, start_at, end_at, min_age, public_path, venue_address, venue_parking_note")
    .eq("id", sessionId)
    .single();
  if (error) {
    console.error("[smsV2] session_display 조회 실패", error);
    return null;
  }
  return data as SessionDisplay;
}

function baseVars(sd: SessionDisplay) {
  return {
    theme_name: sd.theme_name ?? "",
    event_date: eventDate(sd.start_at),
    start_time: startTime(sd.start_at),
    duration: sd.end_at ? formatDuration(sd.start_at, sd.end_at) : "-",
    min_age: sd.min_age != null ? String(sd.min_age) : "",
    reapply_url: `www.wouldyouescape.com${sd.public_path ?? "/contents"}`,
  };
}

/**
 * 공통 발송기.
 * ⚠️ 발송 실패가 어드민 액션을 실패시키면 안 된다. 상태 변경은 이미 커밋됐다.
 */
async function sendTemplate(
  key: string,
  to: string,
  vars: Record<string, string>,
  logLabel: string
): Promise<void> {
  const body = await getTemplateBody(key, "");
  if (!body) {
    console.error(`[smsV2] 템플릿(${key})을 찾을 수 없어 ${logLabel}를 건너뜁니다.`);
    return;
  }
  const text = render(body, vars);

  // 치환되지 않고 남은 {{변수}} 는 고객 문자에 그대로 찍힌다. 발송은 막지
  // 않되(문자를 아예 못 받는 것보다는 낫다) 반드시 로그로 드러낸다.
  const unresolved = [...new Set(text.match(/\{\{\w+\}\}/g) ?? [])];
  if (unresolved.length > 0) {
    console.error(`[smsV2] ${logLabel}(${key}) 미치환 변수: ${unresolved.join(", ")}`);
  }

  // ⚠️ 테스트 환경에서는 절대 실제 발송하지 않는다.
  //    어드민 액션(문자2·4·6·7)과 크론(문자3)은 신청 폼과 달리 호출부에
  //    isTest 가드가 없었다. 테스트 DB 에도 실제 고객 번호가 들어 있어
  //    운영자가 테스트 화면에서 버튼을 눌러보는 것만으로 고객에게 문자가
  //    나갈 수 있었다. 발송기 한 곳에서 막는다.
  //    문구 검증이 가능하도록 렌더링까지는 하고 본문을 로그로 남긴다.
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true") {
    console.log(`[smsV2] 테스트 환경 — ${logLabel} 미발송. 수신 ${to}\n${text}`);
    return;
  }

  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const service = getService();
  if (!service || !senderNumber) {
    console.warn(`[smsV2] SOLAPI_* 미설정 — ${logLabel}를 건너뜁니다.`);
    return;
  }
  try {
    await service.send({ from: senderNumber, to: to.replace(/\D/g, ""), text });
    console.log(`[smsV2] ${logLabel} 발송 완료`);
  } catch (err) {
    console.error(`[smsV2] ${logLabel} 발송 실패`, err);
  }
}

/** 문자2 — 입금확인 */
export async function sendPaymentConfirmedSmsV2(p: {
  session: SessionDisplay;
  to: string;
  name: string;
  confirmationCode: string;
  headcount: number;
}) {
  await sendTemplate("payment_confirmed_v2", p.to, {
    ...baseVars(p.session),
    name: p.name,
    confirmation_code: p.confirmationCode,
    attendee_count: String(p.headcount),
  }, "입금확인 문자");
}

/** 문자4 — 미입금취소 */
export async function sendApplicationCancelledSmsV2(p: {
  session: SessionDisplay;
  to: string;
  name: string;
  confirmationCode: string;
}) {
  await sendTemplate("application_cancelled_v2", p.to, {
    ...baseVars(p.session),
    name: p.name,
    confirmation_code: p.confirmationCode,
  }, "미입금취소 문자");
}

/** 문자6 — 공석입금안내 (대기 → 확정) */
export async function sendWaitlistPromotedSmsV2(p: {
  session: SessionDisplay;
  to: string;
  name: string;
  confirmationCode: string;
  headcount: number;
  amountKrw: number;
  depositorName: string;
}) {
  await sendTemplate("waitlist_promoted_v2", p.to, {
    ...baseVars(p.session),
    name: p.name,
    confirmation_code: p.confirmationCode,
    attendee_count: String(p.headcount),
    price: formatKrw(p.amountKrw),
    bank_name: BANK_ACCOUNT.bankName,
    account_number: BANK_ACCOUNT_NUMBER_SMS,
    account_holder: BANK_ACCOUNT_HOLDER_SMS,
    depositor_name: p.depositorName,
  }, "공석입금안내 문자");
}

/**
 * 문자7 — 회차 취소 (전원 일괄).
 *
 * 회차 비활성화는 확정자뿐 아니라 **대기자까지** 일괄 취소한다. 대기자는
 * 대개 입금 전이므로 "입금하신 금액을 전액 환불" 이라고 보내면 받지도 않은
 * 돈을 돌려준다고 약속하는 셈이 된다. 입금 여부로 문장을 갈라 쓴다.
 */
export async function sendSessionCancelledSmsV2(p: {
  session: SessionDisplay;
  to: string;
  name: string;
  headcount: number;
  refundAmountKrw: number;
  isPaid: boolean;
}) {
  const refundNotice =
    p.isPaid && p.refundAmountKrw > 0
      ? `입금하신 금액 ${formatKrw(p.refundAmountKrw)}은 영업일 기준 3일 내에 전액 환불해 드립니다.`
      : "입금 전 신청이라 환불해 드릴 금액은 없습니다.";

  await sendTemplate("minimum_not_met_cancellation_v2", p.to, {
    ...baseVars(p.session),
    name: p.name,
    attendee_count: String(p.headcount),
    refund_notice: refundNotice,
  }, "회차취소 문자");
}

/**
 * 문자3 — 전날안내 (신규 회차용).
 *
 * 옛 버전은 소개팅/그룹 두 템플릿으로 갈라져 있었고 음주 문구가 들어 있었다.
 * 신규는 템플릿 하나이고 연령이 회차별로 치환된다.
 */
export async function buildEventReminderTextV2(
  sd: SessionDisplay,
  recipientName: string,
  venueAddress: string | null,
  parkingNote: string | null
): Promise<string> {
  const body = await getTemplateBody("event_reminder_v2", "");
  if (!body) return "";
  return render(body, {
    ...baseVars(sd),
    name: recipientName,
    venue_address_text: venueAddress ?? "현장 안내 예정",
    parking_note: parkingNote ?? "인근 유료주차장을 이용해 주세요.",
  });
}

export async function sendEventReminderSmsV2(p: {
  session: SessionDisplay;
  to: string;
  name: string;
  venueAddress: string | null;
  parkingNote: string | null;
}): Promise<void> {
  await sendTemplate("event_reminder_v2", p.to, {
    ...baseVars(p.session),
    name: p.name,
    venue_address_text: p.venueAddress ?? "현장 안내 예정",
    parking_note: p.parkingNote ?? "인근 유료주차장을 이용해 주세요.",
  }, "전날안내 문자");
}
