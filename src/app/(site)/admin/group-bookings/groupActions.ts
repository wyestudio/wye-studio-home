"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { isContactMethod } from "@/lib/groupBooking";
import { GROUP_CLOSURES_TAG } from "@/lib/groupClosures";
import { closeOverlappingSessions, closureLabel } from "@/lib/groupClosureOps";
import { loadGroup, settlementFor, type AdjustmentRow, type GroupRow } from "@/lib/groupAdmin";
import { HHMM, ISO_DATE, OPTION, dateLabel, kstToday } from "@/lib/groupPricing";
import {
  ADJUST_REASONS,
  MONEY_MAX,
  adjustmentError,
  groupRefund,
  isAdjustReason,
  isPayType,
  PAY_TYPES,
  type Adjustment,
} from "@/lib/groupSettlement";
import { isConfirmed, scheduleOf } from "@/lib/groupStage";
import { charCount, cleanLine } from "@/lib/textClean";

/**
 * 단체 예약 운영 — 등록 · 입금 확인 · 일정 변경 · 취소 · 금액(관리자 개편 4단계).
 *
 * ⚠️ **금액은 전부 여기서 다시 계산한다.** 화면이 보낸 총액 · 잔금 · 환불액을 믿지 않는다.
 *    DB 에는 재료(인원 · 일시 · 옵션 · 학생 인원 · 조정 줄 · 받은 예약금)만 저장한다.
 * ⚠️ 돈과 일정이 같이 움직이는 일(입금 확인 · 일정 변경 · 취소)은 DB 함수 하나로 묶여 있다 — 중간에 끊기지 않는다.
 *    겹치는 빈 회차를 닫는 일과 감사로그는 예전 「예약 확정」 과 같은 코드(groupClosureOps.ts)가 이어서 한다.
 * ⚠️ 문자는 보내지 않는다. 이 파일은 발송 함수(sms*.ts)를 import 하지 않는다.
 * ⚠️ 변경 기록(group_booking_history)에는 이름 · 연락처를 넣지 않는다.
 */

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const md = (date: string) => dateLabel(date);

type Loaded = { group: GroupRow; adjustments: AdjustmentRow[] };

async function open(id: string) {
  const supabase = await requireAdmin();
  const loaded = await loadGroup(id);
  if (!loaded) throw new Error("단체를 찾을 수 없습니다.");
  return { supabase, ...loaded, today: kstToday() };
}

function refresh(id: string, closuresChanged = false) {
  if (closuresChanged) updateTag(GROUP_CLOSURES_TAG);
  revalidatePath("/admin");
  revalidatePath("/admin/group-bookings");
  revalidatePath(`/admin/group-bookings/${id}`);
  if (closuresChanged) revalidatePath("/admin/sessions");
}

type Db = Awaited<ReturnType<typeof requireAdmin>>;

async function addHistory(
  supabase: Db,
  id: string,
  kind: string,
  summary: string,
  extra: { reason?: string; detail?: Record<string, unknown> } = {}
) {
  const { error } = await supabase.from("group_booking_history").insert({
    inquiry_id: id,
    kind,
    summary: summary.slice(0, 300),
    reason: extra.reason ?? null,
    detail: extra.detail ?? {},
  });
  // 기록을 못 남겼다고 이미 끝난 변경을 실패로 돌리지 않는다. 다만 조용히 넘기지도 않는다.
  if (error) console.error("[group] 변경 기록 실패", kind, error.message);
}

function scheduleError(date: string, time: string, minutes: number): string | null {
  if (!ISO_DATE.test(date)) return "날짜를 확인해주세요.";
  if (!HHMM.test(time)) return "시작 시각을 확인해주세요.";
  if (!Number.isInteger(minutes) || minutes < 10 || minutes > 1440) return "소요 시간을 확인해주세요(10분 ~ 24시간).";
  return null;
}

function reasonError(reason: string): string | null {
  const n = charCount(reason);
  return n < 2 || n > 200 ? "사유를 2~200자로 적어주세요." : null;
}

/** 금액이 바뀌는 변경의 기록 한 줄 — 무엇이 바뀌었나 + 총액이 어떻게 됐나. */
function moneySummary(what: string, before: Loaded, after: Loaded, today: string): string {
  const b = settlementFor(before.group, before.adjustments, today);
  const a = settlementFor(after.group, after.adjustments, today);
  const unit = b.unit !== a.unit && b.unit != null && a.unit != null ? ` · 1인 ${won(b.unit)} → ${won(a.unit)}` : "";
  const total = b.total !== a.total ? ` · 총액 ${won(b.total)} → ${won(a.total)}` : "";
  return `${what}${unit}${total}`;
}

// ── 등록 ─────────────────────────────────────────────────────────

/** 카카오톡으로 바로 문의한 단체를 운영자가 직접 넣는다. 돌려주는 message 는 새 단체의 id 다. */
export async function createGroup(input: {
  groupName: string;
  organizerName: string;
  contactMethod: string;
  contact: string;
  date: string;
  time: string;
  headcount: number;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const groupName = cleanLine(input.groupName);
    const organizerName = cleanLine(input.organizerName);
    const contact = cleanLine(input.contact);
    if (charCount(groupName) < 2 || charCount(groupName) > 30) return { error: "모임 이름은 2~30자로 넣어주세요." };
    if (!/[\p{L}\p{N}]/u.test(groupName)) return { error: "모임 이름에 글자나 숫자를 넣어주세요." };
    if (!/^[\p{L}][\p{L} .·'-]*$/u.test(organizerName) || charCount(organizerName) < 2 || charCount(organizerName) > 20) {
      return { error: "담당자 이름은 한글이나 영문 2~20자로 넣어주세요." };
    }
    if (!isContactMethod(input.contactMethod)) return { error: "연락 수단을 선택해주세요." };
    if (!contact || charCount(contact) > 100) return { error: "연락처를 확인해주세요." };
    if ((input.contactMethod === "phone" || input.contactMethod === "sms") && !/^010\d{8}$/.test(contact.replace(/\D/g, ""))) {
      return { error: "010으로 시작하는 11자리 번호를 입력해주세요." };
    }
    if (!ISO_DATE.test(input.date)) return { error: "희망 날짜를 넣어주세요." };
    if (!HHMM.test(input.time)) return { error: "시작 시간을 넣어주세요." };
    if (!Number.isInteger(input.headcount) || input.headcount < 2 || input.headcount > 200) {
      return { error: "인원은 2~200 사이로 입력해주세요." };
    }

    const phoneLike = input.contactMethod === "phone" || input.contactMethod === "sms";
    const { data, error } = await supabase.rpc("admin_create_group_inquiry", {
      p_group_name: groupName,
      p_organizer_name: organizerName,
      p_contact_method: input.contactMethod,
      p_contact: phoneLike ? contact.replace(/\D/g, "") : contact,
      p_preferred_date: input.date,
      p_preferred_time: input.time,
      p_headcount: input.headcount,
    });
    if (error) return { error: error.message };
    const id = String(data);

    await writeAuditLog({
      action: "group_booking.created",
      targetType: "group_booking_inquiry",
      targetId: id,
      summary: `단체 직접 등록 — ${input.headcount}명`,
    });
    refresh(id);
    return { success: true, message: id };
  } catch (err) {
    return toActionError(err, "등록에 실패했습니다.");
  }
}

// ── 입금 확인 = 예약 확정 ─────────────────────────────────────────

/**
 * 예약금 입금 확인. 모임장 신청서를 안 냈어도 예약금이 들어오면 확정하고 그 일시를 막는다(대표님 원칙).
 * 이미 확정된 건에서 다시 부르면 받은 금액 · 일시를 고친다.
 */
export async function confirmDeposit(input: {
  id: string;
  amount: number;
  date: string;
  time: string;
  minutes: number;
}): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MONEY_MAX) {
      return { error: "받은 금액은 1원 ~ 1억 원 사이 정수로 넣어주세요." };
    }
    const bad = scheduleError(input.date, input.time, input.minutes);
    if (bad) return { error: bad };

    const again = group.deposit_paid_at != null;
    const summary = again
      ? `예약금 ${won(group.deposit_amount ?? 0)} → ${won(input.amount)} · ${md(input.date)} ${input.time}`
      : `예약금 ${won(input.amount)} 입금 확인 · ${md(input.date)} ${input.time} 예약 확정`;
    const { data, error } = await supabase.rpc("admin_confirm_group_deposit", {
      p_id: input.id,
      p_amount: input.amount,
      p_date: input.date,
      p_time: input.time,
      p_minutes: input.minutes,
      p_summary: summary,
      p_detail: { amount: input.amount, date: input.date, time: input.time, minutes: input.minutes },
    });
    if (error) return { error: error.message };
    const result = (data ?? {}) as { schedule_changed?: boolean };

    const label = closureLabel(input.date, input.time, input.minutes);
    const parts = [again ? "저장했습니다." : "예약 확정했습니다."];
    // 일시가 그대로면 회차를 다시 닫으러 가지 않는다(예전 saveInquiryStatus 와 같다).
    if (result.schedule_changed) {
      const sessions = await closeOverlappingSessions(supabase, input.date, input.time, input.minutes, label);
      parts.push(`${label} 을 막았습니다.`);
      if (sessions.closed.length) parts.push(`겹치는 회차 ${sessions.closed.length}개도 닫았습니다(${sessions.closed.join(", ")}).`);
      if (sessions.kept.length) {
        parts.push(`신청자가 있어 열어 둔 회차: ${sessions.kept.join(", ")} — 회차 관리에서 직접 확인해주세요.`);
      }
    }
    await writeAuditLog({
      action: "group_booking.deposit_confirmed",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary,
      detail: { amount: input.amount, date: input.date, time: input.time, minutes: input.minutes },
    });
    refresh(input.id, true);
    return { success: true, message: parts.join(" ") };
  } catch (err) {
    return toActionError(err, "입금 확인에 실패했습니다.");
  }
}

/** 입금 확인 취소(잘못 눌렀을 때). 예약금 · 잔금 확인을 비우고 막아 둔 일정을 푼다. */
export async function unconfirmDeposit(input: { id: string; reason: string }): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    const reason = cleanLine(input.reason);
    const bad = reasonError(reason);
    if (bad) return { error: bad };
    const summary = `입금 확인 취소 · 예약금 ${won(group.deposit_amount ?? 0)} 기록을 지우고 막아 둔 일정을 풀었습니다`;
    const { error } = await supabase.rpc("admin_unconfirm_group_deposit", { p_id: input.id, p_reason: reason, p_summary: summary });
    if (error) return { error: error.message };
    await writeAuditLog({
      action: "group_booking.deposit_unconfirmed",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary,
      detail: { reason, amount: group.deposit_amount },
    });
    refresh(input.id, true);
    return { success: true, message: "입금 확인을 취소했습니다. 막아 둔 일정도 풀었습니다." };
  } catch (err) {
    return toActionError(err, "입금 확인 취소에 실패했습니다.");
  }
}

// ── 일정 변경 · 취소 ─────────────────────────────────────────────

/** 일정 변경 · 연기. 날짜가 바뀌면 평일/주말 · 성수기 요금으로 다시 계산된다. 받은 예약금은 그대로다. */
export async function rescheduleGroup(input: {
  id: string;
  date: string;
  time: string;
  minutes: number;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { supabase, group, adjustments, today } = await open(input.id);
    const bad = scheduleError(input.date, input.time, input.minutes);
    if (bad) return { error: bad };
    const reason = cleanLine(input.reason);
    const badReason = reasonError(reason);
    if (badReason) return { error: badReason };

    const cur = scheduleOf(group);
    if (cur.fixed && cur.date === input.date && cur.time === input.time && cur.minutes === input.minutes) {
      return { error: "지금 일정과 같습니다." };
    }
    const after: GroupRow = { ...group, event_date: input.date, event_time: input.time, event_minutes: input.minutes };
    const from = cur.date ? `${md(cur.date)} ${cur.time ?? "시간 미정"}` : "날짜 미정";
    const summary = moneySummary(`일정 ${from} → ${md(input.date)} ${input.time}`, { group, adjustments }, { group: after, adjustments }, today);

    const { data, error } = await supabase.rpc("admin_reschedule_group", {
      p_id: input.id,
      p_date: input.date,
      p_time: input.time,
      p_minutes: input.minutes,
      p_reason: reason,
      p_summary: summary,
      p_detail: { before: { date: cur.date, time: cur.time, minutes: cur.minutes }, after: { date: input.date, time: input.time, minutes: input.minutes } },
    });
    if (error) return { error: error.message };
    const confirmed = !!(data as { confirmed?: boolean } | null)?.confirmed;

    const parts = ["일정을 바꿨습니다."];
    if (confirmed) {
      const label = closureLabel(input.date, input.time, input.minutes);
      const sessions = await closeOverlappingSessions(supabase, input.date, input.time, input.minutes, label);
      parts.push(`막아 둔 일정도 ${label} 로 옮겼습니다.`);
      if (sessions.closed.length) parts.push(`겹치는 회차 ${sessions.closed.length}개도 닫았습니다(${sessions.closed.join(", ")}).`);
      if (sessions.kept.length) {
        parts.push(`신청자가 있어 열어 둔 회차: ${sessions.kept.join(", ")} — 회차 관리에서 직접 확인해주세요.`);
      }
    }
    await writeAuditLog({
      action: "group_booking.rescheduled",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary,
      detail: { reason, date: input.date, time: input.time, minutes: input.minutes },
    });
    refresh(input.id, confirmed);
    return { success: true, message: parts.join(" ") };
  } catch (err) {
    return toActionError(err, "일정 변경에 실패했습니다.");
  }
}

/**
 * 취소 · 환불. 환불액은 단체 규정(groupRefund — 14일 전까지 전액 · 13~8일 전 50% · 7일 전부터 환불 불가)으로
 * **서버가** 계산한다. 실제 송금은 운영자가 한다 — 여기서는 금액과 사유를 남기고 막아 둔 일정을 푼다.
 */
export async function cancelGroup(input: { id: string; reason: string }): Promise<ActionResult> {
  try {
    const { supabase, group, today } = await open(input.id);
    const reason = cleanLine(input.reason);
    const bad = reasonError(reason);
    if (bad) return { error: bad };

    const deposit = group.deposit_amount ?? 0;
    const date = scheduleOf(group).date;
    // 행사 날짜가 없는 건(옛 접수분)은 규정을 적용할 기준일이 없다 — 받은 예약금을 전액 돌려준다.
    const refund = date ? groupRefund({ depositPaid: deposit, eventDate: date, today }) : null;
    const amount = refund ? refund.amount : deposit;
    const summary =
      deposit === 0
        ? "취소 · 받은 예약금 없음"
        : `취소 · 예약금 ${won(deposit)} 중 ${won(amount)} 환불${refund ? ` (행사 ${refund.daysLeft}일 전 · ${refund.label})` : ""}`;

    const { error } = await supabase.rpc("admin_cancel_group", {
      p_id: input.id,
      p_reason: reason,
      p_refund_amount: amount,
      p_summary: summary,
      p_detail: { deposit, refund: amount, days_left: refund?.daysLeft ?? null, rate: refund?.rate ?? null },
    });
    if (error) return { error: error.message };
    await writeAuditLog({
      action: "group_booking.cancelled",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary,
      detail: { reason, deposit, refund: amount },
    });
    refresh(input.id, true);
    return {
      success: true,
      message: `취소했습니다. ${deposit === 0 ? "받은 예약금이 없어 환불할 금액이 없습니다." : `환불할 금액은 ${won(amount)}입니다. 송금은 직접 해주세요.`}`,
    };
  } catch (err) {
    return toActionError(err, "취소에 실패했습니다.");
  }
}

// ── 금액 탭 ──────────────────────────────────────────────────────

/** 한 칸을 고치고 변경 기록을 남기는 공통 길. 취소된 단체는 고칠 수 없다. */
async function patchMoney(
  id: string,
  kind: string,
  build: (cur: Loaded, today: string) => { error: string } | { patch: Record<string, unknown>; after: GroupRow; what: string }
): Promise<ActionResult> {
  const { supabase, group, adjustments, today } = await open(id);
  if (group.cancelled_at) return { error: "취소된 단체입니다. 금액을 바꿀 수 없습니다." };
  const res = build({ group, adjustments }, today);
  if ("error" in res) return res;
  const { error } = await supabase
    .from("group_booking_inquiries")
    .update({ ...res.patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  const summary = moneySummary(res.what, { group, adjustments }, { group: res.after, adjustments }, today);
  await addHistory(supabase, id, kind, summary, { detail: res.patch });
  await writeAuditLog({ action: "group_booking.money_changed", targetType: "group_booking_inquiry", targetId: id, summary });
  refresh(id);
  return { success: true, message: "저장했습니다." };
}

/** 인원 변경. 요금 구간이 바뀌면 1인 요금 · 총액 · 잔금이 같이 바뀐다. 받은 예약금은 그대로다. */
export async function saveHeadcount(input: { id: string; headcount: number }): Promise<ActionResult> {
  try {
    return await patchMoney(input.id, "headcount", ({ group }) => {
      if (!Number.isInteger(input.headcount) || input.headcount < 2 || input.headcount > 200) {
        return { error: "인원은 2~200 사이로 입력해주세요." };
      }
      if (input.headcount === group.headcount) return { error: "지금 인원과 같습니다." };
      // 학생 인원이 전체 인원을 넘지 않게 같이 줄인다.
      const student = group.student_count == null ? null : Math.min(group.student_count, input.headcount);
      return {
        patch: { headcount: input.headcount, student_count: student },
        after: { ...group, headcount: input.headcount, student_count: student },
        what: `인원 ${group.headcount}명 → ${input.headcount}명`,
      };
    });
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 옵션(레크리에이션 · 캐릭터 꾸미기 · 애프터파티 · 뒷정리). 뒷정리는 애프터파티가 있을 때만. */
export async function saveOptions(input: {
  id: string;
  icebreaking: boolean;
  character: boolean;
  afterPartyHours: number;
  cleanup: boolean;
}): Promise<ActionResult> {
  try {
    return await patchMoney(input.id, "options", ({ group }) => {
      const h = input.afterPartyHours;
      if (!Number.isInteger(h) || h < 0 || h > OPTION.afterParty.maxHours) return { error: "애프터파티 시간을 확인해주세요(0~4시간)." };
      const options = { icebreaking: !!input.icebreaking, character: !!input.character, after_party_hours: h, cleanup: h > 0 && !!input.cleanup };
      const picks = [
        options.icebreaking ? null : "레크리에이션 제외",
        options.character ? "캐릭터 꾸미기" : null,
        h ? `애프터파티 ${h}시간` : null,
        options.cleanup ? "뒷정리" : null,
      ].filter(Boolean);
      return { patch: { options }, after: { ...group, options }, what: `옵션 → ${picks.length ? picks.join(" · ") : "기본 구성"}` };
    });
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 학생 단체 특가. 학생이 80% 이상이면 전원 학생가, 미만이면 학생 인원만 학생가(groupSettlement.ts). */
export async function saveStudent(input: { id: string; isStudent: boolean; studentCount: number }): Promise<ActionResult> {
  try {
    return await patchMoney(input.id, "student", ({ group }) => {
      if (!input.isStudent) {
        if (!group.is_student_group) return { error: "이미 일반 단체입니다." };
        return {
          patch: { is_student_group: false, student_count: null },
          after: { ...group, is_student_group: false, student_count: null },
          what: "학생 단체 해제",
        };
      }
      if (!Number.isInteger(input.studentCount) || input.studentCount < 0 || input.studentCount > group.headcount) {
        return { error: `학생 인원은 0~${group.headcount}명 사이로 넣어주세요.` };
      }
      return {
        patch: { is_student_group: true, student_count: input.studentCount },
        after: { ...group, is_student_group: true, student_count: input.studentCount },
        what: `학생 단체 · 학생 ${input.studentCount}명 / 전체 ${group.headcount}명`,
      };
    });
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 결제 방식. 7일 전 안내 문구와, 임박 예약에서 받아야 할 금액(계좌이체는 전액 · 카드는 30%)이 이 값을 따른다. */
export async function savePayType(input: { id: string; payType: string }): Promise<ActionResult> {
  try {
    return await patchMoney(input.id, "pay_type", ({ group }) => {
      if (!isPayType(input.payType)) return { error: "결제 방식을 골라주세요." };
      if (input.payType === group.pay_type) return { error: "지금 결제 방식과 같습니다." };
      return {
        patch: { pay_type: input.payType },
        after: { ...group, pay_type: input.payType },
        what: `결제 방식 → ${PAY_TYPES.find((p) => p.code === input.payType)!.label}`,
      };
    });
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 잔금 확인 / 확인 취소. 카드 결제 연동은 없다 — 현장 단말기로 받고 여기서는 확인만 누른다. */
export async function setBalancePaid(input: { id: string; paid: boolean }): Promise<ActionResult> {
  try {
    return await patchMoney(input.id, "balance", ({ group, adjustments }, today) => {
      if (!isConfirmed(group) || group.deposit_paid_at == null) return { error: "예약금 입금 확인을 먼저 해주세요." };
      if (input.paid === (group.balance_paid_at != null)) return { error: input.paid ? "이미 잔금을 확인했습니다." : "잔금 확인 전입니다." };
      const at = input.paid ? new Date().toISOString() : null;
      const balance = settlementFor(group, adjustments, today).balance;
      return {
        patch: { balance_paid_at: at },
        after: { ...group, balance_paid_at: at },
        what: input.paid ? `잔금 ${won(balance)} 확인` : "잔금 확인 취소",
      };
    });
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 법인카드 전액 결제 — 행사 당일 예약금을 돌려줬다는 기록(취소 환불과 다르다). */
export async function setDepositReturned(input: { id: string; returned: boolean }): Promise<ActionResult> {
  try {
    return await patchMoney(input.id, "deposit", ({ group }) => {
      if (group.deposit_paid_at == null) return { error: "받은 예약금이 없습니다." };
      if (input.returned === (group.deposit_returned_at != null)) return { error: "이미 그 상태입니다." };
      const at = input.returned ? new Date().toISOString() : null;
      return {
        patch: { deposit_returned_at: at },
        after: { ...group, deposit_returned_at: at },
        what: input.returned ? `예약금 ${won(group.deposit_amount ?? 0)} 반환(법인카드 전액 결제)` : "예약금 반환 기록 취소",
      };
    });
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 조정 줄 추가. 정액(원) 또는 기본요금의 %, 더하기 / 빼기. */
export async function addAdjustment(input: {
  id: string;
  reason: string;
  label: string;
  amount: number | null;
  pct: number | null;
  sign: number;
  note?: string;
}): Promise<ActionResult> {
  try {
    const { supabase, group, adjustments, today } = await open(input.id);
    if (group.cancelled_at) return { error: "취소된 단체입니다. 금액을 바꿀 수 없습니다." };
    if (!isAdjustReason(input.reason)) return { error: "조정 사유를 골라주세요." };
    // 총액 조정 줄은 overrideTotal 만 만든다 — 사유(필수)를 거치지 않고 생기지 않게.
    if (input.reason === "total_override") return { error: "총액 조정은 「총액 직접 수정」 으로 넣어주세요." };
    const label = cleanLine(input.label) || ADJUST_REASONS.find((r) => r.code === input.reason)!.label;
    if (charCount(label) > 40) return { error: "이름은 40자까지 쓸 수 있어요." };
    const note = cleanLine(input.note ?? "");
    if (charCount(note) > 200) return { error: "메모는 200자까지 쓸 수 있어요." };
    const adj: Adjustment = {
      reason: input.reason,
      label,
      amount: input.amount,
      pct: input.pct,
      sign: input.sign === -1 ? -1 : 1,
    };
    if (input.sign !== 1 && input.sign !== -1) return { error: "더하기 · 빼기를 골라주세요." };
    const bad = adjustmentError(adj);
    if (bad) return { error: bad };

    const { data, error } = await supabase
      .from("group_booking_adjustments")
      .insert({ inquiry_id: input.id, reason_code: adj.reason, label, amount: adj.amount, pct: adj.pct, sign: adj.sign, note: note || null })
      .select("*")
      .single();
    if (error) return { error: error.message };

    const how = adj.amount != null ? won(adj.amount) : `기본요금의 ${adj.pct}%`;
    const summary = moneySummary(
      `조정 추가 · ${label} ${adj.sign === 1 ? "+" : "−"}${how}`,
      { group, adjustments },
      { group, adjustments: [...adjustments, data as AdjustmentRow] },
      today
    );
    await addHistory(supabase, input.id, "adjustment", summary, { detail: { reason: adj.reason, amount: adj.amount, pct: adj.pct, sign: adj.sign } });
    await writeAuditLog({ action: "group_booking.money_changed", targetType: "group_booking_inquiry", targetId: input.id, summary });
    refresh(input.id);
    return { success: true, message: "조정 줄을 등록했습니다." };
  } catch (err) {
    return toActionError(err, "등록에 실패했습니다.");
  }
}

/** 조정 줄 삭제. */
export async function removeAdjustment(input: { id: string; adjustmentId: string }): Promise<ActionResult> {
  try {
    const { supabase, group, adjustments, today } = await open(input.id);
    if (group.cancelled_at) return { error: "취소된 단체입니다. 금액을 바꿀 수 없습니다." };
    const target = adjustments.find((a) => a.id === input.adjustmentId);
    if (!target) return { error: "조정 줄을 찾을 수 없습니다." };
    const { error } = await supabase.from("group_booking_adjustments").delete().eq("id", target.id).eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    const summary = moneySummary(
      `조정 삭제 · ${target.label}`,
      { group, adjustments },
      { group, adjustments: adjustments.filter((a) => a.id !== target.id) },
      today
    );
    await addHistory(supabase, input.id, "adjustment", summary, { detail: { removed: target.reason_code, amount: target.amount, pct: target.pct, sign: target.sign } });
    await writeAuditLog({ action: "group_booking.money_changed", targetType: "group_booking_inquiry", targetId: input.id, summary });
    refresh(input.id);
    return { success: true, message: "조정 줄을 삭제했습니다." };
  } catch (err) {
    return toActionError(err, "삭제에 실패했습니다.");
  }
}

/**
 * 총액 직접 수정 — 맞출 총액과 사유(필수)를 받아 차액을 「총액 조정」 줄로 넣는다. 원래 계산은 지우지 않는다.
 * 요금표가 없는 인원(6~24명 밖 · 별도 상담)의 금액도 이 길로 넣는다.
 */
export async function overrideTotal(input: { id: string; target: number; reason: string }): Promise<ActionResult> {
  try {
    const { supabase, group, adjustments, today } = await open(input.id);
    if (group.cancelled_at) return { error: "취소된 단체입니다. 금액을 바꿀 수 없습니다." };
    if (!Number.isInteger(input.target) || input.target < 1 || input.target > MONEY_MAX) {
      return { error: "총액은 1원 ~ 1억 원 사이 정수로 넣어주세요." };
    }
    const reason = cleanLine(input.reason);
    const bad = reasonError(reason);
    if (bad) return { error: bad };
    const current = settlementFor(group, adjustments, today).total;
    const diff = input.target - current;
    if (diff === 0) return { error: "지금 총액과 같습니다." };

    const { data, error } = await supabase
      .from("group_booking_adjustments")
      .insert({
        inquiry_id: input.id,
        reason_code: "total_override",
        label: "총액 조정",
        amount: Math.abs(diff),
        pct: null,
        sign: diff > 0 ? 1 : -1,
        note: reason,
      })
      .select("*")
      .single();
    if (error) return { error: error.message };
    const summary = moneySummary("총액 직접 수정", { group, adjustments }, { group, adjustments: [...adjustments, data as AdjustmentRow] }, today);
    await addHistory(supabase, input.id, "adjustment", summary, { reason, detail: { target: input.target, diff } });
    await writeAuditLog({ action: "group_booking.money_changed", targetType: "group_booking_inquiry", targetId: input.id, summary, detail: { reason } });
    refresh(input.id);
    return { success: true, message: `총액을 ${won(input.target)}으로 맞췄습니다.` };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

// ── 메모 · 기본 정보 · 연락처 ────────────────────────────────────

/** 운영 메모. 고객에게 보이지 않는다. */
export async function saveMemo(input: { id: string; memo: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    const memo = String(input.memo ?? "").normalize("NFC").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (charCount(memo) > 4000) return { error: "메모는 4,000자까지 쓸 수 있어요." };
    const { error } = await supabase
      .from("group_booking_inquiries")
      .update({ admin_memo: memo || null, updated_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: "저장했습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 모임 이름 수정. */
export async function saveGroupName(input: { id: string; groupName: string }): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    const name = cleanLine(input.groupName);
    if (charCount(name) < 2 || charCount(name) > 30) return { error: "모임 이름은 2~30자로 넣어주세요." };
    if (!/[\p{L}\p{N}]/u.test(name)) return { error: "모임 이름에 글자나 숫자를 넣어주세요." };
    if (name === group.group_name) return { error: "지금 이름과 같습니다." };
    const { error } = await supabase
      .from("group_booking_inquiries")
      .update({ group_name: name, updated_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "info", `모임 이름 ${group.group_name ?? "(없음)"} → ${name}`);
    refresh(input.id);
    return { success: true, message: "저장했습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/**
 * 「연락처 보기」 — 담당자 이름과 연락처 전체를 이때만 복호화해 내려준다.
 * 누가 언제 어느 단체의 연락처를 봤는지 감사로그에 남긴다(값 자체는 남기지 않는다).
 */
export async function revealContact(input: {
  id: string;
}): Promise<{ name: string; contact: string; method: string } | { error: string }> {
  try {
    const supabase = await requireAdmin();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.id)) return { error: "단체를 찾을 수 없습니다." };
    const { data, error } = await supabase
      .from("admin_group_booking_inquiries_view")
      .select("organizer_name, contact, contact_method")
      .eq("id", input.id)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "단체를 찾을 수 없습니다." };
    const row = data as { organizer_name: string | null; contact: string; contact_method: string };
    await writeAuditLog({
      action: "group_booking.contact_viewed",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary: "단체 담당자 연락처 보기",
    });
    return { name: row.organizer_name ?? "", contact: row.contact, method: row.contact_method };
  } catch (err) {
    return toActionError(err, "연락처를 불러오지 못했습니다.");
  }
}
