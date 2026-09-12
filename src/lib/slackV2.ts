import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw, formatDateTimeDotted } from "@/lib/format";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";

/**
 * 테마·회차 구조용 Slack 알림.
 *
 * 기존 src/lib/slack.ts 는 옛 Session 타입(session_type·content_group·price_krw,
 * 성별 정원)에 묶여 있어 신규 회차에 쓸 수 없다. 옛 화면이 아직 그걸 쓰므로
 * 건드리지 않고 새 파일로 분리한다 (smsV2 와 같은 방식).
 *
 * ⚠️ 2026-09-13 확인: 신규 신청폼(/themes/[slug]/apply)이 Slack 알림을 **아예
 *    부르지 않고 있었다.** 레거시 폼에만 붙어 있어서, 테마 구조로 넘어온 뒤로
 *    새 신청이 들어와도 Slack 에 아무것도 오지 않았다.
 *
 * ⚠️ 알림 실패가 신청·취소 자체를 실패시키면 안 된다. 전부 삼키고 로그만 남긴다.
 */

const GENDER_LABEL: Record<string, string> = { M: "남", F: "여" };

async function post(webhookUrl: string | undefined, text: string, label: string): Promise<void> {
  if (!webhookUrl) {
    console.warn(`[slackV2] 웹훅 URL 미설정 — ${label} 알림을 건너뜁니다.`);
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[slackV2] ${label} 전송 실패: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[slackV2] ${label} 전송 중 에러`, err);
  }
}

/** 그 회차의 현재 확정·대기 인원. 알림 한 줄로 붙인다. */
async function headcountLine(sessionId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("admin_attendee_view")
      .select("application_id, applications!inner(status)")
      .eq("session_id", sessionId);
    if (!data) return null;

    let confirmed = 0;
    let waiting = 0;
    for (const row of data as unknown as { applications: { status: string } }[]) {
      if (row.applications?.status === "confirmed") confirmed += 1;
      else if (row.applications?.status === "waiting") waiting += 1;
    }
    return `현재 인원 — 확정 ${confirmed}명 · 대기 ${waiting}명`;
  } catch (err) {
    console.error("[slackV2] 인원 현황 조회 실패", err);
    return null;
  }
}

/** 문자1 과 같은 시점에 나가는 새 신청 알림. */
export async function sendApplicationSlackAlertV2(p: {
  sessionId: string;
  themeName: string;
  /** '9월 26일 (토) 19:30' 같은 표시용 문구 */
  sessionLabel: string;
  confirmationCode: string;
  status: string;
  createdAt: string;
  headcount: number;
  amountKrw: number;
  discountKrw: number;
  depositorName: string;
  representative: {
    name: string;
    nickname?: string | null;
    birthYear?: number | null;
    gender?: string | null;
    experienceRange?: string | null;
  };
}): Promise<void> {
  // 입금기한. 신청 완료 화면·문자1 이 안내하는 30분과 같아야 한다.
  const deadline = new Date(new Date(p.createdAt).getTime() + 30 * 60 * 1000).toISOString();
  const rep = p.representative;

  const lines = [
    `📥 새신청 — ${p.themeName} ${p.sessionLabel}${p.status === "waiting" ? " [대기]" : ""}`,
    `접수번호: ${p.confirmationCode}`,
    `신청자명: ${rep.name}${rep.nickname ? ` (${rep.nickname})` : ""}`,
    `출생년도: ${rep.birthYear ?? "-"}년`,
    `성별: ${rep.gender ? (GENDER_LABEL[rep.gender] ?? rep.gender) : "-"}`,
    `방탈출 횟수: ${
      rep.experienceRange
        ? (EXPERIENCE_RANGE_LABELS[rep.experienceRange as keyof typeof EXPERIENCE_RANGE_LABELS] ??
          rep.experienceRange)
        : "-"
    }`,
    `인원: ${p.headcount}명`,
    "",
    `입금자명: ${p.depositorName}`,
    p.discountKrw > 0
      ? `입금액: ${formatKrw(p.amountKrw)} (쿠폰 −${formatKrw(p.discountKrw)})`
      : `입금액: ${formatKrw(p.amountKrw)}`,
    `신청일시: ${formatDateTimeDotted(p.createdAt)}`,
    `입금기한: ${formatDateTimeDotted(deadline)}`,
  ];

  const hc = await headcountLine(p.sessionId);
  if (hc) lines.push("", hc);

  await post(process.env.SLACK_WEBHOOK_URL, lines.join("\n"), "새신청");
}

/**
 * 환불이 필요한 취소 알림.
 *
 * ⚠️ 셀프 취소뿐 아니라 **어드민 취소**에서도 불러야 한다. 예전에는 /lookup
 *    셀프 취소에만 붙어 있어서, 운영자가 어드민에서 입금된 건을 취소하면
 *    환불이 필요한데도 Slack 에 아무것도 오지 않았다.
 */
export async function sendRefundNeededSlackAlertV2(p: {
  themeName: string;
  sessionLabel: string;
  confirmationCode: string;
  representativeName: string;
  representativePhone: string;
  refundAmountKrw: number;
  refundBankName?: string | null;
  refundAccountNumber?: string | null;
  refundAccountHolder?: string | null;
  /** 누가 취소했는지 — '고객' 또는 '어드민' */
  cancelledBy: "고객" | "어드민";
}): Promise<void> {
  const lines = [
    `💰 환불 필요 — ${p.themeName} ${p.sessionLabel}`,
    `접수번호: ${p.confirmationCode}`,
    `신청자: ${p.representativeName} (${p.representativePhone})`,
    `취소 주체: ${p.cancelledBy}`,
    "",
    "💳 환불 금액 및 계좌",
    `금액: ${formatKrw(p.refundAmountKrw)}`,
  ];

  if (p.refundBankName && p.refundAccountNumber && p.refundAccountHolder) {
    lines.push(`은행: ${p.refundBankName}`);
    lines.push(`계좌: ${p.refundAccountNumber}`);
    lines.push(`예금주: ${p.refundAccountHolder}`);
  } else {
    lines.push("계좌: 미등록 — 고객에게 계좌를 받아야 합니다.");
  }

  await post(process.env.SLACK_REFUND_WEBHOOK_URL, lines.join("\n"), "환불 필요");
}

/**
 * 회차 비활성화처럼 **여러 건이 한꺼번에** 취소될 때의 환불 알림.
 *
 * ⚠️ 건당 한 통씩 보내면 Slack 이 도배돼서 오히려 안 읽힌다. 한 통으로 묶는다.
 */
export async function sendBulkRefundNeededSlackAlertV2(p: {
  themeName: string;
  sessionLabel: string;
  items: {
    confirmationCode: string;
    name: string;
    phone: string;
    amountKrw: number;
    hasAccount: boolean;
  }[];
}): Promise<void> {
  if (p.items.length === 0) return;

  const total = p.items.reduce((sum, i) => sum + i.amountKrw, 0);
  const lines = [
    `💰 회차 취소로 환불 필요 ${p.items.length}건 — ${p.themeName} ${p.sessionLabel}`,
    `합계: ${formatKrw(total)}`,
    "",
    ...p.items.map(
      (i) =>
        `• \`${i.confirmationCode}\` ${i.name} (${i.phone}) — ${formatKrw(i.amountKrw)}${
          i.hasAccount ? "" : " · 계좌 미등록"
        }`
    ),
  ];

  await post(process.env.SLACK_REFUND_WEBHOOK_URL, lines.join("\n"), "회차취소 환불 필요");
}
