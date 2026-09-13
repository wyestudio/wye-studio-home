import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw, formatDateTimeDotted } from "@/lib/format";
import { EXPERIENCE_RANGE_LABELS } from "@/lib/validation";
import { renderTemplate, type TemplateBlocks, type TemplateVars } from "@/lib/messageTemplate";

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
 * ⚠️ 본문은 slack_templates 에서 읽는다 — 운영자가 어드민에서 고칠 수 있어야
 *    한다(문자와 같은 원칙). 템플릿을 못 읽으면 아래 FALLBACK 으로 보낸다.
 *    알림이 통째로 멈추는 것보다 낫다.
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

/**
 * 템플릿 본문. 못 읽으면 폴백으로 떨어진다(알림이 멈추면 안 된다).
 *
 * 크론(미입금 알림)도 같은 표를 쓰므로 밖으로 연다.
 */
export async function getSlackTemplateBody(key: string, fallback: string): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("slack_templates").select("body").eq("key", key).single();
    return data?.body || fallback;
  } catch {
    return fallback;
  }
}

/** 그 회차의 현재 확정·대기 인원. 알림 한 줄로 붙인다. */
async function headcounts(sessionId: string): Promise<{ confirmed: string; waiting: string }> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("admin_attendee_view")
      .select("application_id, applications!inner(status)")
      .eq("session_id", sessionId);
    if (!data) return { confirmed: "?", waiting: "?" };

    let confirmed = 0;
    let waiting = 0;
    for (const row of data as unknown as { applications: { status: string } }[]) {
      if (row.applications?.status === "confirmed") confirmed += 1;
      else if (row.applications?.status === "waiting") waiting += 1;
    }
    return { confirmed: String(confirmed), waiting: String(waiting) };
  } catch (err) {
    console.error("[slackV2] 인원 현황 조회 실패", err);
    return { confirmed: "?", waiting: "?" };
  }
}

export type SlackAttendee = {
  name: string;
  phone: string;
  nickname?: string | null;
  birthYear?: number | null;
  gender?: string | null;
  experienceRange?: string | null;
};

/** 반복 블록 한 줄에 들어갈 값. 어드민 미리보기와 반드시 같은 키를 써야 한다. */
export function attendeeRow(a: SlackAttendee, i: number): TemplateVars {
  return {
    index: String(i + 1),
    role: i === 0 ? "대표" : "동행",
    name: a.name,
    phone: a.phone,
    nickname: a.nickname?.trim() || "",
    nickname_paren: a.nickname?.trim() ? `(${a.nickname.trim()})` : "",
    birth_year: a.birthYear != null ? String(a.birthYear) : "-",
    gender: a.gender ? (GENDER_LABEL[a.gender] ?? a.gender) : "-",
    experience: a.experienceRange
      ? (EXPERIENCE_RANGE_LABELS[a.experienceRange as keyof typeof EXPERIENCE_RANGE_LABELS] ??
        a.experienceRange)
      : "-",
  };
}

const FALLBACK_APPLICATION = `📥 새신청 — {{theme_name}} {{session_label}}{{status_suffix}}
접수번호: {{confirmation_code}}
인원: {{headcount}}명

{{#attendees}}
{{index}}. {{role}} {{name}}{{nickname_paren}} · {{birth_year}}년생 · {{gender}} · 방탈출 {{experience}} · {{phone}}
{{/attendees}}

입금자명: {{depositor_name}}
입금액: {{amount}}{{discount_suffix}}
신청일시: {{created_at}}
입금기한: {{payment_deadline}}

현재 인원 — 확정 {{confirmed_count}}명 · 대기 {{waiting_count}}명`;

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
  notes?: string | null;
  /** 대표가 [0] 번이다. 동행자까지 전부 넘긴다 */
  attendees: SlackAttendee[];
}): Promise<void> {
  // 입금기한. 신청 완료 화면·문자1 이 안내하는 30분과 같아야 한다.
  const deadline = new Date(new Date(p.createdAt).getTime() + 30 * 60 * 1000).toISOString();
  const rep = p.attendees[0];
  const counts = await headcounts(p.sessionId);
  const repRow = rep ? attendeeRow(rep, 0) : null;

  const vars: TemplateVars = {
    theme_name: p.themeName,
    session_label: p.sessionLabel,
    status: p.status === "waiting" ? "대기" : "확정",
    status_suffix: p.status === "waiting" ? " [대기]" : "",
    confirmation_code: p.confirmationCode,
    headcount: String(p.headcount),
    depositor_name: p.depositorName,
    amount: formatKrw(p.amountKrw),
    base_amount: formatKrw(p.amountKrw + p.discountKrw),
    discount: formatKrw(p.discountKrw),
    discount_suffix: p.discountKrw > 0 ? ` (쿠폰 −${formatKrw(p.discountKrw)})` : "",
    created_at: formatDateTimeDotted(p.createdAt),
    payment_deadline: formatDateTimeDotted(deadline),
    confirmed_count: counts.confirmed,
    waiting_count: counts.waiting,
    notes: p.notes?.trim() || "",
    rep_name: repRow?.name ?? "-",
    rep_phone: repRow?.phone ?? "-",
    rep_nickname: repRow?.nickname ?? "",
    rep_birth_year: repRow?.birth_year ?? "-",
    rep_gender: repRow?.gender ?? "-",
    rep_experience: repRow?.experience ?? "-",
  };

  const blocks: TemplateBlocks = {
    attendees: p.attendees.map(attendeeRow),
    companions: p.attendees.slice(1).map((a, i) => attendeeRow(a, i + 1)),
  };

  const body = await getSlackTemplateBody("application_new", FALLBACK_APPLICATION);
  await post(process.env.SLACK_WEBHOOK_URL, renderTemplate(body, vars, blocks), "새신청");
}

const FALLBACK_REFUND = `💰 환불 필요 — {{theme_name}} {{session_label}}
접수번호: {{confirmation_code}}
신청자: {{rep_name}} ({{rep_phone}})
취소 주체: {{cancelled_by}}
인원: {{headcount}}명

💳 환불 금액 및 계좌
금액: {{refund_amount}}
{{refund_account_block}}`;

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
  headcount?: number;
  refundBankName?: string | null;
  refundAccountNumber?: string | null;
  refundAccountHolder?: string | null;
  /** 누가 취소했는지 — '고객' 또는 '어드민' */
  cancelledBy: "고객" | "어드민";
  /** 아는 경우에만. 모르면 블록이 비어 사라진다 */
  attendees?: SlackAttendee[];
}): Promise<void> {
  const hasAccount = !!(p.refundBankName && p.refundAccountNumber && p.refundAccountHolder);

  const vars: TemplateVars = {
    theme_name: p.themeName,
    session_label: p.sessionLabel,
    confirmation_code: p.confirmationCode,
    headcount: p.headcount != null ? String(p.headcount) : String(p.attendees?.length ?? 1),
    cancelled_by: p.cancelledBy,
    refund_amount: formatKrw(p.refundAmountKrw),
    refund_bank: p.refundBankName ?? "",
    refund_account: p.refundAccountNumber ?? "",
    refund_holder: p.refundAccountHolder ?? "",
    // 계좌가 있으면 세 줄, 없으면 받아야 한다고 알린다. 한 변수로 묶어둬야
    // 운영자가 포맷을 고쳐도 '계좌 미등록' 안내가 빠지지 않는다.
    refund_account_block: hasAccount
      ? `은행: ${p.refundBankName}\n계좌: ${p.refundAccountNumber}\n예금주: ${p.refundAccountHolder}`
      : "계좌: 미등록 — 고객에게 계좌를 받아야 합니다.",
    rep_name: p.representativeName,
    rep_phone: p.representativePhone,
  };

  const blocks: TemplateBlocks = p.attendees
    ? {
        attendees: p.attendees.map(attendeeRow),
        companions: p.attendees.slice(1).map((a, i) => attendeeRow(a, i + 1)),
      }
    : {};

  const body = await getSlackTemplateBody("refund_needed", FALLBACK_REFUND);
  await post(process.env.SLACK_REFUND_WEBHOOK_URL, renderTemplate(body, vars, blocks), "환불 필요");
}

const FALLBACK_BULK_REFUND = `💰 회차 취소로 환불 필요 {{count}}건 — {{theme_name}} {{session_label}}
합계: {{total_amount}}

{{#items}}
• \`{{confirmation_code}}\` {{name}} ({{phone}}) — {{amount}}{{account_suffix}}
{{/items}}`;

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

  const vars: TemplateVars = {
    theme_name: p.themeName,
    session_label: p.sessionLabel,
    count: String(p.items.length),
    total_amount: formatKrw(total),
  };

  const blocks: TemplateBlocks = {
    items: p.items.map((i, idx) => ({
      index: String(idx + 1),
      confirmation_code: i.confirmationCode,
      name: i.name,
      phone: i.phone,
      amount: formatKrw(i.amountKrw),
      account_suffix: i.hasAccount ? "" : " · 계좌 미등록",
    })),
  };

  const body = await getSlackTemplateBody("bulk_refund_needed", FALLBACK_BULK_REFUND);
  await post(
    process.env.SLACK_REFUND_WEBHOOK_URL,
    renderTemplate(body, vars, blocks),
    "회차취소 환불 필요"
  );
}
