import "server-only";
import type { Application, Session, ApplicationAttendee } from "@/types/domain";
import type { AttendeeInput } from "@/types/domain";
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
 *    그래서 테스트에서 눌러 본 접수가 진짜 접수처럼 채널에 올라간다. 신청 알림은
 *    테스트에서 아예 안 보내지만(apply/actions.ts), 이쪽은 문자처럼 돈이 들지도
 *    고객에게 가지도 않아서 **[테스트] 를 붙여 보낸다** — 알림이 실제로 오는지
 *    테스트에서 확인할 수 있어야 한다.
 */
export async function sendGroupBookingInquirySlackAlert({
  headcount,
  preferredDate,
  preferredTime,
  groupKind,
  contactMethod,
  contact,
}: {
  headcount: number;
  preferredDate: string | null;
  preferredTime: string;
  groupKind: string;
  contactMethod: string;
  contact: string;
}): Promise<void> {
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
    `모임: ${groupKind}`,
    `연락: ${contactMethod} ${contact}`,
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
