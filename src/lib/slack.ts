import "server-only";
import type { Application, Session, ApplicationAttendee } from "@/types/domain";
import type { AttendeeInput } from "@/types/domain";
import { formatKrw, formatDateTimeDotted } from "@/lib/format";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import { getSessionStats } from "@/lib/sessions";
import { createClient } from "@/lib/supabase/server";
import { formatPhoneDigits } from "@/lib/phone";

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
    `출생연도: ${representative?.birthYear ?? "-"}년`,
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

/**
 * 환경변수에서 **슬랙 웹훅 주소로 쓸 수 있는 값만** 꺼낸다. 아니면 null.
 *
 * 왜 검사하는가
 *   값이 주소가 아니어도 코드는 그대로 돌아가고 `fetch` 안에서야 터진다. 알림은
 *   조용히 안 오고 로그에만 남아서, 밖에서 보면 "등록했는데 왜 안 오지" 가 된다.
 *   2026-10-02 에 Vercel 환경변수의 **값 칸에 변수 이름**(`SLACK_GROUP_BOOKING_WEBHOOK_URL`)
 *   이 들어가 있어 실제로 그렇게 됐다.
 *
 *   비어 있지 않다는 것만 보면 그 값이 폴백(기본 채널)까지 막아버린다. 모양을 보고
 *   아니면 버려서 **기본 채널로라도 가게** 한다 — 알림이 아예 안 오는 쪽이 더 나쁘다.
 */
function pickSlackWebhook(name: string): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  if (!raw.startsWith("https://hooks.slack.com/")) {
    console.error(
      `[slack] ${name} 의 값이 슬랙 웹훅 주소가 아니라 무시합니다. ` +
        `Vercel 환경변수의 '값' 칸에 https://hooks.slack.com/services/... 를 넣었는지 확인하세요.`
    );
    return null;
  }
  return raw;
}

/**
 * 단체 예약 견적 신청 알림.
 *
 * 연락처까지 싣는다 — 알림만 보고 바로 연락할 수 있어야 한다(2026-10-02 요청).
 * 신청 알림(`slackV2.ts`)이 이미 이름·전화번호를 싣고 있어 기준도 같다.
 *
 * ⚠️ 그래도 **요청사항(note)은 싣지 않는다.** 길어서 채널을 덮기도 하고, 본인
 *    사정이 적히는 칸이라 더 민감하다. 전체 내용은 어드민 목록에서 본다.
 *
 * 전용 웹훅이 없으면 기본 채널로 보낸다 — 알림이 안 가는 쪽이 더 나쁘다.
 *
 * ⚠️ 테스트 환경(`test.wouldyouescape.com`)도 **운영과 같은 슬랙 웹훅**을 쓴다.
 *    그래서 테스트에서 눌러 본 접수가 진짜 접수처럼 채널에 올라간다. 테스트에서는
 *    보내지 않는다(2026-10-28 대표님) — 테스트 신청이 운영 채널에 쌓이고 지울 수도 없었다.
 *    알림 문구를 테스트에서 다시 확인해야 하면 이 검사를 잠시 빼고 [테스트] 머리말로 본다.
 */
export async function sendGroupBookingInquirySlackAlert({
  headcount,
  preferredDate,
  preferredTime,
  organizerName,
  groupName = null,
  groupKind = null,
  contactMethod,
  contact,
  estimate = null,
  deposit = null,
  options = [],
  note = null,
}: {
  headcount: number;
  preferredDate: string | null;
  preferredTime: string;
  organizerName: string;
  /** 모임 · 단체 이름(선택). */
  groupName?: string | null;
  /** 모임 성격 라벨(선택). */
  groupKind?: string | null;
  contactMethod: string;
  contact: string;
  /** 서버가 계산한 예상 총액. 요금표 밖(25명 이상 등)이면 null. */
  estimate?: number | null;
  /** 예약금(예상 총액의 30%, 천 원 단위 반올림). 총액이 없으면 null. */
  deposit?: number | null;
  /** 고른 옵션 한 줄씩('애프터파티 2시간'). */
  options?: string[];
  /** 손님이 적은 요청사항(선택). 애프터파티 5시간 이상 같은 문의가 여기로 온다. */
  note?: string | null;
}): Promise<void> {
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true") return;

  const webhookUrl =
    pickSlackWebhook("SLACK_GROUP_BOOKING_WEBHOOK_URL") ?? pickSlackWebhook("SLACK_WEBHOOK_URL");
  if (!webhookUrl) {
    console.warn("[slack] 쓸 수 있는 웹훅이 없어 단체 예약 견적 신청 알림을 건너뜁니다.");
    return;
  }

  const testPrefix = process.env.NEXT_PUBLIC_IS_TEST_ENV === "true" ? "[테스트] " : "";

  const text = [
    `${testPrefix}[단체예약] 새 견적 신청`,
    `인원: ${headcount}명`,
    `희망: ${preferredDate ?? "날짜 미정"} ${preferredTime}`,
    `담당자: ${organizerName}`,
    // '모임: 미입력' 하나로 두면 모임 이름을 안 쓴 건지 성격을 안 고른 건지 헷갈렸다 — 두 줄로 나눈다.
    `모임 이름: ${groupName ?? "미입력"}`,
    `모임 성격: ${groupKind ?? "미입력"}`,
    `옵션: ${options.length ? options.join(", ") : "없음"}`,
    `예상 금액: ${estimate == null ? "상담 후 안내" : `${estimate.toLocaleString("ko-KR")}원`}`,
    ...(deposit == null ? [] : [`예약금(30%): ${deposit.toLocaleString("ko-KR")}원`]),
    `연락: ${contactMethod} ${contact}`,
    // 손님이 쓴 글이라 < > & 를 그대로 두면 슬랙이 링크·멘션으로 해석한다.
    ...(note ? [`요청사항:\n${note.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`] : []),
  ].join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] 단체 예약 견적 신청 알림 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] 단체 예약 견적 신청 알림 전송 중 에러", err);
  }
}

const SPONSORSHIP_TAG: Record<"group" | "dating", string> = {
  group: "[그룹]",
  dating: "[소개팅-여성]",
};

export async function sendSponsorshipApplicationSlackAlert({
  type,
  name,
  handle,
}: {
  type: "group" | "dating";
  name: string;
  handle: string;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_SPONSORSHIP_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[slack] SLACK_SPONSORSHIP_WEBHOOK_URL이 설정되지 않아 협찬 신청 알림을 건너뜁니다.");
    return;
  }

  const text = [`${SPONSORSHIP_TAG[type]} 새 협찬 신청`, `이름: ${name}`, `채널명: ${handle}`].join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] 협찬 신청 알림 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] 협찬 신청 알림 전송 중 에러", err);
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

/**
 * 후기 수집 크론 실패 알림 (backup-alert 채널).
 *
 * 왜 알림이 필요한가
 *   인스타 토큰은 **보통 60일이면 만료되고, 만료돼도 화면에는 아무 일도 안 일어난다.**
 *   새 후기가 안 쌓일 뿐이라 두 달쯤 뒤에야 "왜 안 들어오지" 하게 된다.
 *   네이버 키의 스코프가 빠지거나 한도를 넘어도 똑같이 조용하다.
 *   ← keepalive 잡이 "조용히 아무것도 안 하는 잡은 없는 잡보다 나쁘다" 로 같은 교훈을 남겼다.
 *
 * 전용 웹훅이 없으면 기본 채널로 보낸다 — 알림이 아예 안 가는 쪽이 더 나쁘다.
 */
export async function sendReviewCollectFailureAlert({
  errors,
  inserted,
}: {
  errors: string[];
  inserted: number;
}): Promise<void> {
  const webhookUrl =
    pickSlackWebhook("SLACK_BACKUP_ALERT_WEBHOOK_URL") ?? pickSlackWebhook("SLACK_WEBHOOK_URL");
  if (!webhookUrl) {
    console.warn("[slack] 쓸 수 있는 웹훅이 없어 후기 수집 실패 알림을 건너뜁니다.");
    return;
  }

  const testPrefix = process.env.NEXT_PUBLIC_IS_TEST_ENV === "true" ? "[테스트] " : "";

  const text = [
    `${testPrefix}:rotating_light: 후기 수집 실패`,
    `새로 담은 건수: ${inserted}건`,
    "",
    // 토큰 만료·스코프 누락 같은 건 원문이 가장 정확하다. 다듬지 않고 그대로 싣는다.
    ...errors.slice(0, 5).map((e) => `• ${e}`),
    errors.length > 5 ? `…외 ${errors.length - 5}건` : "",
    "",
    "인스타 토큰은 만료되면 조용히 멈춥니다. 만료라면 장기 토큰을 다시 발급해 IG_ACCESS_TOKEN 을 갱신하세요.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] 후기 수집 실패 알림 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] 후기 수집 실패 알림 전송 중 에러", err);
  }
}

/**
 * 문자 발송 실패 알림 (backup-alert 채널).
 *
 * 왜 알림이 필요한가
 *   문자 실패는 신청·어드민 처리를 막지 않도록 로그만 남기고 넘어간다. 그래서 솔라피 키가
 *   만료되자 **2주 가까이 모든 문자가 안 나갔는데 아무도 몰랐다**(2026-11-08 ~ 11-21).
 *   고객이 "입금 안내를 못 받았다" 고 연락해 와서야 알았다. 서버 로그는 1시간만 남는다.
 *
 * 받는 사람 번호를 싣는다 — 알림만 보고 그 고객에게 직접 연락할 수 있어야 한다.
 * 신청 알림(`slackV2.ts`)이 이미 연락처를 싣고 있어 기준도 같다.
 *
 * ⚠️ 이 함수는 절대 throw 하지 않는다. 문자 실패를 알리다가 신청을 실패시키면 안 된다.
 */
export async function sendSmsFailureAlert({
  label,
  reason,
  recipients,
  context,
}: {
  /** 어떤 문자인가 — "신청확인 문자", "장소안내 문자" 등 */
  label: string;
  /** 실패 원인. 솔라피 오류 원문을 그대로 */
  reason: string;
  /** 받지 못한 사람의 번호 */
  recipients: string[];
  /** 접수번호처럼 그 건을 찾을 단서 */
  context?: string;
}): Promise<void> {
  // 테스트 환경은 문자를 보내지 않으므로 실패할 일도 없다. 혹시 생겨도 운영 채널에
  // 테스트 알림을 올리지 않는다(단체 예약 알림과 같은 결정 — 2026-10-28).
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true") return;

  try {
    const webhookUrl =
      pickSlackWebhook("SLACK_BACKUP_ALERT_WEBHOOK_URL") ?? pickSlackWebhook("SLACK_WEBHOOK_URL");
    if (!webhookUrl) {
      console.warn("[slack] 쓸 수 있는 웹훅이 없어 문자 발송 실패 알림을 건너뜁니다.");
      return;
    }

    // 한 번에 수백 명이 실패해도 채널을 덮지 않도록 앞의 몇 명만 싣는다.
    const SHOWN = 10;
    const shown = recipients.slice(0, SHOWN).map(formatPhoneDigits);

    const facts = [
      `:rotating_light: 문자 발송 실패 — ${label} ${recipients.length}건`,
      context ? `건: ${context}` : null,
      `받지 못한 번호: ${shown.join(", ")}${recipients.length > SHOWN ? ` 외 ${recipients.length - SHOWN}명` : ""}`,
      `사유: ${reason}`,
    ].filter((l): l is string => l !== null);
    const text = [
      ...facts,
      "",
      "이 고객들은 문자를 받지 못했습니다. 필요하면 직접 연락해 주세요.",
      "사유가 API Key·잔액 문제라면 이후 문자도 전부 실패합니다 — console.solapi.com 에서 확인하세요.",
    ].join("\n");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slack] 문자 발송 실패 알림 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[slack] 문자 발송 실패 알림 전송 중 에러", err);
  }
}

/** 솔라피 오류를 사람이 읽을 한 줄로. 오류 이름(ExpiredApiKey 등)이 원인을 가장 잘 말해준다. */
export function smsErrorText(err: unknown): string {
  if (err instanceof Error) {
    // 솔라피 SDK 는 메시지 앞에 이미 원인 이름을 붙여 오기도 한다("ValidationError: …").
    // 그때 겉 이름(ClientError)을 또 붙이면 읽기만 어렵다.
    if (/^\w+: /.test(err.message) || !err.name || err.name === "Error") return err.message;
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}
