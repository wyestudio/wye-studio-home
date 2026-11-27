import "server-only";
import { BANK_ACCOUNT_LINE } from "@/lib/bankAccountPrivate";
import type { AdjustmentRow, GroupRow } from "@/lib/groupAdmin";
import { settlementFor } from "@/lib/groupAdmin";
import { addDays, addMinutes, dateLabel } from "@/lib/groupPricing";
import { depositSuggest, isPayType, requiredDeposit } from "@/lib/groupSettlement";
import { effectiveStage, isConfirmed, maskName, scheduleOf, stageIndex, type GroupStage } from "@/lib/groupStage";
import { renderTemplate, type TemplateBlocks, type TemplateVars } from "@/lib/messageTemplate";

/**
 * 단체 예약 안내 문자 — **복사 전용**(관리자 개편 docs/02 8장).
 *
 * ⚠️ 여기서 문자를 보내지 않는다. 이 파일은 발송 코드(sms*.ts · solapi)를 import 하지 않는다.
 *    운영자가 「문자 복사」 를 눌러 카카오톡 채널에 직접 붙여넣는다(대표님 원칙).
 * ⚠️ 문구 원본은 sms_templates 의 group_* 줄이다(운영자가 고칠 수 있다). 여기서는 그 단체의 값만 채운다.
 * ⚠️ 미리보기에는 담당자 이름을 가려서(김*윤) 넣는다. 전체 이름이 들어간 문구는 「문자 복사」 를 눌렀을 때만 만든다.
 */

export const MESSAGE_KINDS = [
  { kind: "quote", label: "견적 안내", to: "contacted" },
  { kind: "deposit", label: "예약금 확인", to: null },
  { kind: "nudge", label: "신청서 재촉", to: null },
  { kind: "d7", label: "7일 전 안내", to: "d7" },
  { kind: "d1", label: "하루 전 안내", to: "d1" },
  { kind: "report", label: "리포트 전달", to: "report" },
] as const satisfies readonly { kind: string; label: string; to: GroupStage | null }[];
export type MessageKind = (typeof MESSAGE_KINDS)[number]["kind"];
export const isMessageKind = (v: string): v is MessageKind => MESSAGE_KINDS.some((m) => m.kind === v);

/** 이 문자가 쓰는 sms_templates 키. 7일 전 안내는 결제 방식에 따라 셋 중 하나다. */
export function templateKeyOf(kind: MessageKind, payType: string): string {
  if (kind !== "d7") return `group_${kind}`;
  return payType === "card_balance" ? "group_d7_card" : payType === "corp_card_full" ? "group_d7_corp_card" : "group_d7_transfer";
}

/** 지금 이 문자를 쓸 수 없으면 그 이유. 쓸 수 있으면 null. */
export function messageBlockedReason(kind: MessageKind, g: GroupRow, today: string): string | null {
  if (g.cancelled_at) return "취소된 단체입니다.";
  const sch = scheduleOf(g);
  if (!sch.date || !sch.time) return "날짜 · 시작 시간이 정해져야 문구를 만들 수 있습니다. 머리의 「일정 수정」 에서 넣어주세요.";
  if (kind === "quote") return null;
  if (g.deposit_paid_at == null) {
    return isConfirmed(g) ? "받은 예약금이 기록돼 있지 않습니다. 금액 탭에서 입금 확인을 해주세요." : "예약금 입금 확인 뒤에 쓸 수 있습니다.";
  }
  if (kind === "report" && stageIndex(effectiveStage(g, today)) < stageIndex("done")) return "행사가 끝난 뒤에 쓸 수 있습니다.";
  return null;
}

/** 이 문자를 복사하면 넘어갈 단계. 이미 그 단계를 지났거나 넘어가지 않는 문자면 null. 단계는 앞으로만 간다. */
export function stageAfterCopy(kind: MessageKind, g: GroupRow, today: string): GroupStage | null {
  const to = MESSAGE_KINDS.find((m) => m.kind === kind)!.to;
  if (!to) return null;
  return stageIndex(effectiveStage(g, today)) < stageIndex(to) ? to : null;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** '15:00' → '오후 3시', '09:30' → '오전 9시 30분'. */
export function timeKo(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${h12}시${m ? ` ${m}분` : ""}`;
}

/** 추천 팀 수 — 올림(인원 ÷ 4), 최대 6팀(docs/02 10장). */
export const teamCountFor = (headcount: number) => Math.min(6, Math.max(1, Math.ceil(headcount / 4)));

/** 링크를 아직 만들지 못했을 때 링크 자리에 넣는 글. */
const FORM_LINK_PENDING = "(폼 링크 준비 중)";

/**
 * 한 단체의 문자 문구를 만든다.
 * @param leaderName 문구에 넣을 담당자 이름 — 미리보기는 가린 이름, 복사는 전체 이름.
 */
export function renderGroupMessage(input: {
  kind: MessageKind;
  body: string;
  group: GroupRow;
  adjustments: readonly AdjustmentRow[];
  today: string;
  leaderName: string;
  /** 그 단체의 폼 주소. 아직 링크가 없으면 비워 둔다. */
  urls?: { leader?: string; participant?: string; review?: string };
}): string {
  const { group: g, today } = input;
  const s = settlementFor(g, input.adjustments, today);
  const sch = scheduleOf(g);
  const date = sch.date ?? today;
  const time = sch.time ?? "00:00";
  // 도착 시간 = 시작 15분 전
  const [h, m] = time.split(":").map(Number);
  const arrive = Math.max(0, h * 60 + m - 15);
  const arriveHHMM = `${String(Math.floor(arrive / 60)).padStart(2, "0")}:${String(arrive % 60).padStart(2, "0")}`;

  const vars: TemplateVars = {
    leader_name: input.leaderName,
    group_name: g.display_name ?? g.group_name ?? "단체",
    event_date: dateLabel(date),
    event_time_ko: timeKo(time),
    event_range: `${time}~${addMinutes(time, sch.minutes)}`,
    arrive_time_ko: timeKo(arriveHHMM),
    headcount: String(g.headcount),
    unit_price: s.unit != null ? won(s.unit) : "별도 상담가",
    base_amount: won(s.base),
    total: won(s.total),
    deposit_suggest: won(depositSuggest(s.total)),
    deposit_paid: won(g.deposit_amount ?? 0),
    balance: won(s.balance),
    // 모임장 본인에게 가는 안내라 예금주 전체 이름을 적는다(2026-11-27 대표님). 문구 원본에는 계좌를 직접 적지 않는다.
    bank_account: BANK_ACCOUNT_LINE,
    leader_form_url: input.urls?.leader ?? FORM_LINK_PENDING,
    participant_form_url: input.urls?.participant ?? FORM_LINK_PENDING,
    review_form_url: input.urls?.review ?? FORM_LINK_PENDING,
    d7_date: dateLabel(addDays(date, -7)),
    team_count: String(teamCountFor(g.headcount)),
  };
  // 옵션 · 조정 줄. 할인은 '-68,800원' 처럼 적는다.
  const blocks: TemplateBlocks = {
    lines: [...s.optionLines, ...s.adjustmentLines].map((l) => ({
      label: l.label,
      amount: `${l.amount < 0 ? "-" : ""}${won(Math.abs(l.amount))}`,
    })),
  };

  // 기본 프로그램 줄 — 요금표가 없거나(별도 상담) 학생 · 일반이 섞이면 '인원 × 1인 요금' 한 줄로 쓸 수 없다.
  let body = input.body;
  const single = "• 방탈출: {{headcount}}명 × {{unit_price}} = {{base_amount}}";
  if (body.includes(single)) {
    if (!s.priced) body = body.replace(single, "• 방탈출: {{headcount}}명 · 별도 상담가");
    else if (s.baseLines.length > 1) {
      body = body.replace(single, s.baseLines.map((l) => `• 방탈출${l.label.replace("기본 프로그램", "")}: ${l.detail} = ${won(l.amount)}`).join("\n"));
    }
  }
  // 옵션 · 조정 줄이 하나도 없으면 블록 자리에 빈 줄이 남는다 — 줄바꿈까지 같이 지운다.
  if (blocks.lines.length === 0) body = body.replace(/\{\{#lines\}\}[\s\S]*?\{\{\/lines\}\}\n?/, "");

  // 임박 예약(행사 7일 이내) + 계좌이체는 예약금 30% 가 아니라 **전액** 입금 시 확정이다(2026-11-27 대표님).
  // 기본 문구의 '30% 예약금' 문장을 전액 안내로 바꾼다. 운영자가 그 문장을 고쳐 둔 경우에는 못 바꾸므로
  // 화면(fullPaymentNotice)이 따로 알려준다.
  if (input.kind === "quote" && needsFullPayment(g, s.total, today)) {
    body = body.replace(
      "예약 확정을 위해 총 이용 금액의 30%인 {{deposit_suggest}}을 아래 계좌로 입금 부탁드립니다.",
      "행사 7일 이내 예약은 전액 결제 시 확정됩니다. 총 이용 금액 {{total}}을 아래 계좌로 입금 부탁드립니다."
    );
  }
  return renderTemplate(body, vars, blocks);
}

/** 지금 확정하려면 전액을 받아야 하나(행사 7일 이내 + 계좌이체). */
function needsFullPayment(g: GroupRow, total: number, today: string): boolean {
  const date = scheduleOf(g).date;
  if (!date || g.deposit_paid_at != null) return false;
  return requiredDeposit({ total, eventDate: date, today, payType: isPayType(g.pay_type) ? g.pay_type : "transfer" }).full;
}

/**
 * 견적 안내 문자 위에 띄울 확인 문구 — 전액 입금 건인데 문구에 그 안내가 들어갔는지 운영자가 한 번 보게 한다.
 * 해당 없으면 null.
 */
export function fullPaymentNotice(g: GroupRow, adjustments: readonly AdjustmentRow[], today: string): string | null {
  const total = settlementFor(g, adjustments, today).total;
  return needsFullPayment(g, total, today)
    ? `행사 7일 이내 예약이고 계좌이체라 전액(${won(total)}) 입금 시 확정입니다. 문구의 입금 안내가 전액으로 나왔는지 확인하고 보내세요.`
    : null;
}

/** 미리보기에 넣는 가린 이름. */
export const previewName = (g: GroupRow) => maskName(g.organizer_name);
