"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { isContactMethod } from "@/lib/groupBooking";
import { GROUP_CLOSURES_TAG } from "@/lib/groupClosures";
import { ensureFormLinks, formUrl } from "@/lib/groupFormLinks";
import { closeOverlappingSessions, closureLabel } from "@/lib/groupClosureOps";
import {
  createChecklistIfMissing,
  loadGroup,
  loadGroupTemplates,
  settlementFor,
  type AdjustmentRow,
  type GroupRow,
} from "@/lib/groupAdmin";
import { isMessageKind, messageBlockedReason, renderGroupMessage, stageAfterCopy, templateKeyOf, MESSAGE_KINDS } from "@/lib/groupMessages";
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
import { GROUP_STAGES, effectiveStage, isConfirmed, optionMinutes, scheduleOf, stageIndex, stageLabel, toSettlementOptions } from "@/lib/groupStage";
import { flattenTemplate } from "@/lib/groupForms/template";
import { loadTemplate, loadTemplateVersion } from "@/lib/groupFormTemplates";
import { answerText } from "@/lib/groupForms/leaderForm";
import { PENDING_KEYS, parsePending, type PendingItem } from "@/lib/groupForms/leaderForm";
import { otherKey } from "@/lib/groupForms/schema";
import { cleanText, cleanValue, isVisible, otherError, pickedOther, questionError, type Answers } from "@/lib/groupForms/validate";
import { syncEventChecklist } from "@/lib/groupLeader";
import { TEAM_MAX, TEAM_NAME_MAX, TEAM_SLOGAN_MAX, isNametagMode, nametagColor, type Team } from "@/lib/groupTeams";
import { loadNametagMode, loadTeamPeople } from "@/lib/groupPeople";
import { REPORT_FILE, buildReportFill, cleanReportState, reportTeams, type ReportFill, type ReportState, type ReportTeam } from "@/lib/groupReport";
import { loadSavedTeams } from "@/lib/groupPeople";
import { reconcileTeams, suggestTeams } from "@/lib/groupTeams";
import { REPORT_DEFAULTS_KEY, cleanReportDefaults } from "@/lib/groupToolRules";
import { NAMETAG_BUCKET, NAMETAG_FILE, cleanNametagState, nametagRoster, type NametagPerson, type NametagState } from "@/lib/groupNametag";
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
    // 확정되면 준비 체크리스트를 양식에서 복사해 만든다(이미 있으면 그대로 둔다).
    try {
      const made = await createChecklistIfMissing(input.id);
      if (made > 0) parts.push(`준비 체크리스트 ${made}줄을 만들었습니다.`);
    } catch (e) {
      console.error("[group] 체크리스트 생성 실패", e);
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

// ── 폼 링크 ─────────────────────────────────────────────────────

/** 그 단체의 폼 주소 셋(없으면 만든다). 안내 문자에 넣는다. */
async function formUrls(id: string) {
  const links = await ensureFormLinks(id);
  return { leader: formUrl(links.leader), participant: formUrl(links.participant), review: formUrl(links.review) };
}

/**
 * 폼 링크 다시 발급 — 이전 링크는 그 자리에서 무효가 된다(이미 보낸 문자 속 링크도 안 열린다).
 * 링크가 엉뚱한 곳에 퍼졌을 때 쓴다. 누가 언제 했는지 감사로그에 남긴다.
 */
export async function reissueFormLink(input: { id: string; formKey: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    if (!["leader", "participant", "review"].includes(input.formKey)) return { error: "알 수 없는 폼입니다." };
    const { error } = await supabase.rpc("admin_reissue_group_form_link", { p_inquiry_id: input.id, p_form_key: input.formKey });
    if (error) return { error: error.message };
    await writeAuditLog({
      action: "group_booking.updated",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary: `단체 폼 링크 다시 발급 — ${input.formKey}`,
    });
    refresh(input.id);
    return { success: true, message: "새 링크를 만들었습니다. 이전 링크는 더 이상 열리지 않습니다." };
  } catch (err) {
    return toActionError(err, "링크를 다시 만들지 못했습니다.");
  }
}

// ── 안내 문자(복사 전용) · 단계 ──────────────────────────────────

/**
 * 「문자 복사」 — 전체 이름이 들어간 완성 문구를 돌려주고, 복사한 시각을 남기고, 규칙대로 단계를 넘긴다.
 *   견적 안내 → 연락 완료 · 7일 전 안내 → 7일 전 안내 · 하루 전 안내 → 하루 전 안내 · 리포트 전달 → 리포트 · 후기
 * ⚠️ **문자를 보내지 않는다.** 글자를 돌려줄 뿐이고, 붙여넣어 보내는 것은 운영자다.
 */
export async function copyMessage(input: { id: string; kind: string }): Promise<{ text: string; note: string } | { error: string }> {
  try {
    const { supabase, group, adjustments, today } = await open(input.id);
    if (!isMessageKind(input.kind)) return { error: "알 수 없는 문자입니다." };
    const blocked = messageBlockedReason(input.kind, group, today);
    if (blocked) return { error: blocked };
    const key = templateKeyOf(input.kind, group.pay_type);
    const body = (await loadGroupTemplates()).get(key);
    if (!body) return { error: `문자 문구(${key})를 찾을 수 없습니다.` };

    const text = renderGroupMessage({
      kind: input.kind,
      body,
      group,
      adjustments,
      today,
      leaderName: group.organizer_name ?? "담당자",
      urls: await formUrls(input.id),
    });

    const to = stageAfterCopy(input.kind, group, today);
    const label = MESSAGE_KINDS.find((m) => m.kind === input.kind)!.label;
    const patch: Record<string, unknown> = {
      messages_copied: { ...(group.messages_copied ?? {}), [key]: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    };
    if (to) {
      patch.stage = to;
      // 옛 상태 칸도 같이 맞춘다(접수 → 연락 완료).
      if (to === "contacted" && group.status === "new") patch.status = "contacted";
    }
    const { error } = await supabase.from("group_booking_inquiries").update(patch).eq("id", input.id);
    if (error) return { error: error.message };
    if (to) {
      await addHistory(supabase, input.id, "stage", `「${label}」 문자 복사 · 단계 ${stageLabel(effectiveStage(group, today))} → ${stageLabel(to)}`);
    }
    refresh(input.id);
    return { text, note: to ? `복사했습니다. 단계가 「${stageLabel(to)}」 로 넘어갔습니다.` : "복사했습니다." };
  } catch (err) {
    return toActionError(err, "문구를 만들지 못했습니다.");
  }
}

/**
 * 단계 한 칸 되돌리기 — 문자를 잘못 복사해 단계가 넘어갔을 때(2026-11-27 대표님).
 * 「예약 확정」 을 되돌리는 것은 여기서 하지 않는다 — 금액 탭의 「입금 확인 취소」 로만 한다(막아 둔 일정이 풀려야 한다).
 */
export async function stepBackStage(input: { id: string }): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    if (group.cancelled_at) return { error: "취소된 단체입니다." };
    const i = stageIndex(group.stage);
    if (i <= 0) return { error: "더 되돌릴 단계가 없습니다." };
    if (group.stage === "confirmed") return { error: "예약 확정은 금액 탭의 「입금 확인 취소」 로 되돌려주세요." };
    const prev = GROUP_STAGES[i - 1].code;
    const patch: Record<string, unknown> = { stage: prev, updated_at: new Date().toISOString() };
    if (prev === "new" && group.status === "contacted") patch.status = "new";
    const { error } = await supabase.from("group_booking_inquiries").update(patch).eq("id", input.id);
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "stage", `단계 되돌리기 · ${stageLabel(group.stage)} → ${stageLabel(prev)}`);
    refresh(input.id);
    return { success: true, message: `「${stageLabel(prev)}」 로 되돌렸습니다.` };
  } catch (err) {
    return toActionError(err, "되돌리지 못했습니다.");
  }
}

/** 담당자 이름 변경. 이름은 암호화해 넣어야 해서 DB 함수(admin_update_group_booking_inquiry)를 거친다. 기록에는 이름을 남기지 않는다. */
export async function changeOrganizerName(input: { id: string; name: string }): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    const name = cleanLine(input.name);
    if (!/^[\p{L}][\p{L} .·'-]*$/u.test(name) || charCount(name) < 2 || charCount(name) > 20) {
      return { error: "이름은 한글이나 영문 2~20자로 입력해주세요." };
    }
    const { error } = await supabase.rpc("admin_update_group_booking_inquiry", {
      p_id: input.id,
      p_headcount: group.headcount,
      p_group_name: group.group_name ?? "",
      p_organizer_name: name,
      p_options: null,
    });
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "info", "담당자 이름 변경");
    await writeAuditLog({ action: "group_booking.updated", targetType: "group_booking_inquiry", targetId: input.id, summary: "단체 담당자 이름 변경" });
    refresh(input.id);
    return { success: true, message: "담당자 이름을 바꿨습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

// ── 준비 체크리스트 ──────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 체크리스트 만들기 — 확정됐는데 체크리스트가 없는 단체(개편 전에 확정된 건)용. */
export async function makeChecklist(input: { id: string }): Promise<ActionResult> {
  try {
    await open(input.id);
    const made = await createChecklistIfMissing(input.id);
    refresh(input.id);
    return { success: true, message: made > 0 ? `체크리스트 ${made}줄을 만들었습니다.` : "이미 체크리스트가 있습니다." };
  } catch (err) {
    return toActionError(err, "체크리스트를 만들지 못했습니다.");
  }
}

/** 항목 완료 / 완료 취소. */
export async function setChecklistDone(input: { id: string; itemId: string; done: boolean }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    if (!UUID.test(input.itemId)) return { error: "항목을 찾을 수 없습니다." };
    const { error } = await supabase
      .from("group_checklist_items")
      .update({ done_at: input.done ? new Date().toISOString() : null })
      .eq("id", input.itemId)
      .eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 항목 등록(단체별). */
export async function addChecklistItem(input: { id: string; label: string; owner?: string }): Promise<ActionResult> {
  try {
    const { supabase, checklist } = await open(input.id);
    const label = cleanLine(input.label);
    const owner = cleanLine(input.owner ?? "");
    if (charCount(label) < 1 || charCount(label) > 60) return { error: "항목은 1~60자로 적어주세요." };
    if (charCount(owner) > 20) return { error: "담당자는 20자까지 쓸 수 있어요." };
    if (checklist.length >= 50) return { error: "항목은 50개까지 둘 수 있어요." };
    const idx = checklist.reduce((m, c) => Math.max(m, c.idx), -1) + 1;
    const { error } = await supabase.from("group_checklist_items").insert({ inquiry_id: input.id, idx, label, owner: owner || null });
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: "항목을 등록했습니다." };
  } catch (err) {
    return toActionError(err, "등록에 실패했습니다.");
  }
}

/** 항목의 담당자 수정. */
export async function setChecklistOwner(input: { id: string; itemId: string; owner: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    if (!UUID.test(input.itemId)) return { error: "항목을 찾을 수 없습니다." };
    const owner = cleanLine(input.owner);
    if (charCount(owner) > 20) return { error: "담당자는 20자까지 쓸 수 있어요." };
    const { error } = await supabase
      .from("group_checklist_items")
      .update({ owner: owner || null })
      .eq("id", input.itemId)
      .eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: "저장했습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 항목 삭제(단체별). */
export async function removeChecklistItem(input: { id: string; itemId: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    if (!UUID.test(input.itemId)) return { error: "항목을 찾을 수 없습니다." };
    const { error } = await supabase.from("group_checklist_items").delete().eq("id", input.itemId).eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: "항목을 삭제했습니다." };
  } catch (err) {
    return toActionError(err, "삭제에 실패했습니다.");
  }
}

// ── 모임장 신청서 ────────────────────────────────────────────────

/** 신청서 한 줄을 읽는다(암호화 칸은 읽지 않는다). 없으면 예외. */
async function leaderRow(
  supabase: Db,
  id: string
): Promise<{ answers: Answers; pending: PendingItem[]; locked: boolean; edit_request: string | null; template_version: number }> {
  const { data, error } = await supabase
    .from("group_leader_responses")
    .select("answers, pending, locked, edit_request, template_version")
    .eq("inquiry_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("아직 신청서가 없습니다.");
  const r = data as { answers: Answers; pending: unknown; locked: boolean; edit_request: string | null; template_version: number };
  return { answers: r.answers ?? {}, pending: parsePending(r.pending), locked: r.locked, edit_request: r.edit_request, template_version: r.template_version };
}

/**
 * 「수정 열어주기」 — 모임장이 신청서를 고쳐 다시 낼 수 있게 잠금을 푼다. 다시 내면 다시 잠긴다.
 * 남아 있던 수정 요청은 처리된 것으로 본다.
 */
export async function unlockLeaderForm(input: { id: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    await leaderRow(supabase, input.id);
    const { error } = await supabase
      .from("group_leader_responses")
      .update({ locked: false, edit_request: null, edit_requested_at: null, updated_at: new Date().toISOString() })
      .eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "info", "모임장 신청서 수정 열어주기");
    await writeAuditLog({ action: "group_booking.leader_form_unlocked", targetType: "group_booking_inquiry", targetId: input.id, summary: "모임장 신청서 수정 열어주기" });
    refresh(input.id);
    return { success: true, message: "수정을 열었습니다. 모임장이 같은 링크에서 고쳐 다시 낼 수 있어요." };
  } catch (err) {
    return toActionError(err, "수정을 열지 못했습니다.");
  }
}

/** 열어 둔 수정을 다시 잠근다(잘못 열었을 때). */
export async function lockLeaderForm(input: { id: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    await leaderRow(supabase, input.id);
    const { error } = await supabase.from("group_leader_responses").update({ locked: true }).eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "info", "모임장 신청서 다시 잠금");
    refresh(input.id);
    return { success: true, message: "다시 잠갔습니다." };
  } catch (err) {
    return toActionError(err, "잠그지 못했습니다.");
  }
}

/** 수정 요청 「처리 완료」 — 운영자가 직접 고쳤거나 연락해 정리했을 때. */
export async function resolveLeaderEdit(input: { id: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    const row = await leaderRow(supabase, input.id);
    if (!row.edit_request) return { error: "남아 있는 수정 요청이 없습니다." };
    const { error } = await supabase.from("group_leader_responses").update({ edit_request: null, edit_requested_at: null }).eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "info", "모임장 수정 요청 처리 완료");
    refresh(input.id);
    return { success: true, message: "처리 완료로 표시했습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/**
 * 「신청서와 다른 내용」 한 줄을 반영하거나(apply) 넘긴다(skip).
 * 반영은 금액 탭 · 일정 수정과 **같은 길**로 한다 — 금액은 서버가 다시 계산하고 기록이 남는다.
 */
export async function settleLeaderPending(input: { id: string; key: string; apply: boolean }): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    if (!(PENDING_KEYS as readonly string[]).includes(input.key)) return { error: "항목을 찾을 수 없습니다." };
    const row = await leaderRow(supabase, input.id);
    const item = row.pending.find((p) => p.key === input.key);
    if (!item) return { error: "이미 처리된 항목입니다." };

    let message = "넘겼습니다. 지금 값을 그대로 둡니다.";
    if (input.apply) {
      const opt = toSettlementOptions(group.options);
      let res: ActionResult;
      if (item.key === "headcount") {
        res = await saveHeadcount({ id: input.id, headcount: item.headcount });
      } else if (item.key === "after_party") {
        res = await saveOptions({ id: input.id, icebreaking: opt.icebreaking, character: opt.character, afterPartyHours: item.hours, cleanup: opt.cleanup });
      } else if (item.key === "cleanup") {
        if (item.cleanup && opt.afterPartyHours === 0) return { error: "정리 지원은 애프터파티가 있을 때만 넣을 수 있어요. 애프터파티를 먼저 반영해주세요." };
        res = await saveOptions({ id: input.id, icebreaking: opt.icebreaking, character: opt.character, afterPartyHours: opt.afterPartyHours, cleanup: item.cleanup });
      } else if (item.key === "schedule") {
        if (group.deposit_paid_at) return { error: "이미 확정된 단체입니다. 일정은 「일정 수정」 으로 바꿔주세요." };
        res = await rescheduleGroup({ id: input.id, date: item.date, time: item.time, minutes: optionMinutes(group.options), reason: "모임장 신청서 반영" });
      } else {
        const { error } = await supabase.rpc("admin_apply_group_leader_name", { p_inquiry_id: input.id });
        res = error ? { error: error.message } : { success: true };
        if (!error) {
          await addHistory(supabase, input.id, "info", "담당자 이름 변경 (모임장 신청서 반영)");
          await writeAuditLog({ action: "group_booking.updated", targetType: "group_booking_inquiry", targetId: input.id, summary: "단체 담당자 이름 변경(신청서 반영)" });
        }
      }
      if ("error" in res) return res;
      message = res.message && res.message !== "저장했습니다." ? `반영했습니다. ${res.message}` : "반영했습니다.";
    }

    const rest = row.pending.filter((p) => p.key !== input.key);
    const { error } = await supabase.from("group_leader_responses").update({ pending: rest }).eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    if (!input.apply) await addHistory(supabase, input.id, "info", `신청서와 다른 내용 넘김 — ${item.label}`);
    refresh(input.id);
    return { success: true, message };
  } catch (err) {
    return toActionError(err, "처리하지 못했습니다.");
  }
}

/**
 * 운영자가 받은 신청서의 답 하나를 직접 고친다. 공개 폼과 **같은 검증**을 거친다.
 * 고친 사람 · 시각을 남기고 감사로그에 기록한다. 견적에서 온 값(모임 이름 · 인원 · 일시 · 모임 성격)은 여기서 고치지 않는다 —
 * 그 값은 단체 정보라 각자의 자리(모임 이름 수정 · 금액 탭 · 일정 수정)에서 고친다.
 */
export async function saveLeaderAnswer(input: { id: string; questionId: string; value: unknown; other?: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    const row = await leaderRow(supabase, input.id);
    // 그 신청서를 낼 때의 양식으로 본다. 견적에서 온 값(기본 정보 묶음)은 여기서 고치지 않는다.
    const then = await loadTemplateVersion("leader", row.template_version);
    const editable = flattenTemplate(then.template, { skip: ["base"] });
    const q = editable.find((x) => x.id === input.questionId);
    if (!q) return { error: "고칠 수 없는 항목입니다." };
    const answers: Answers = { ...row.answers };
    if (!isVisible(q, answers)) return { error: "앞 문항의 답 때문에 지금은 해당하지 않는 항목입니다." };

    const v = cleanValue(q, input.value);
    const bad = questionError(q, v, answers);
    if (bad) return { error: bad };
    delete answers[otherKey(q.id)];
    if (pickedOther(q, v)) {
      const text = cleanText(input.other);
      const otherBad = otherError(text);
      if (otherBad) return { error: otherBad };
      answers[otherKey(q.id)] = text;
    }
    if (v === "" || (Array.isArray(v) && v.length === 0)) delete answers[q.id];
    else answers[q.id] = v;
    // 이 답 때문에 더는 해당하지 않게 된 뒤 문항의 답은 지운다(예: 팀 편성을 바꾸면 「직접 구성 기준」).
    for (const x of editable) {
      if (!isVisible(x, answers)) {
        delete answers[x.id];
        delete answers[otherKey(x.id)];
      }
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("group_leader_responses")
      .update({ answers, admin_updated_by: "어드민", admin_updated_at: now, updated_at: now })
      .eq("inquiry_id", input.id);
    if (error) return { error: error.message };
    // 화면에 띄우는 값은 단체 정보에도 같이 둔다(리포트 · 팀 편성이 거기서 읽는다).
    if (q.id === "display" && typeof v === "string" && v) {
      await supabase.from("group_booking_inquiries").update({ display_name: v, updated_at: now }).eq("id", input.id);
    }
    if (q.id === "welcome") {
      await supabase.from("group_booking_inquiries").update({ welcome_text: typeof v === "string" && v ? v : null, updated_at: now }).eq("id", input.id);
    }
    if (q.id === "event" || q.id === "eventDetail") {
      try {
        await syncEventChecklist(input.id);
      } catch (err) {
        console.error("[group] 이벤트 체크리스트 줄 맞추기 실패", err);
      }
    }
    const summary = `모임장 신청서 직접 수정 — ${q.label.slice(0, 40)}`;
    await addHistory(supabase, input.id, "info", summary);
    await writeAuditLog({ action: "group_booking.leader_form_edited", targetType: "group_booking_inquiry", targetId: input.id, summary, detail: { question: q.id } });
    refresh(input.id);
    return { success: true, message: "저장했습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 신청서의 휴대폰 번호 보기 — 누를 때만 복호화해 내려준다. 누가 언제 봤는지 감사로그에 남긴다. */
export async function revealLeaderPhone(input: { id: string }): Promise<{ phone: string } | { error: string }> {
  try {
    const supabase = await requireAdmin();
    if (!UUID.test(input.id)) return { error: "단체를 찾을 수 없습니다." };
    const { data, error } = await supabase.from("admin_group_leader_responses_view").select("phone").eq("inquiry_id", input.id).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "아직 신청서가 없습니다." };
    await writeAuditLog({ action: "group_booking.contact_viewed", targetType: "group_booking_inquiry", targetId: input.id, summary: "모임장 신청서 휴대폰 번호 보기" });
    const d = String((data as { phone: string }).phone ?? "").replace(/\D/g, "");
    return { phone: d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d };
  } catch (err) {
    return toActionError(err, "번호를 불러오지 못했습니다.");
  }
}

/** 담당자 연락처 변경. 암호화해 넣어야 해서 DB 함수를 거친다. 기록 · 감사로그에는 값을 남기지 않는다. */
export async function changeContact(input: { id: string; method: string; contact: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    if (!isContactMethod(input.method)) return { error: "연락 방법을 골라주세요." };
    const contact = cleanLine(input.contact);
    if (charCount(contact) < 2 || charCount(contact) > 100) return { error: "연락처를 2~100자로 적어주세요." };
    if ((input.method === "phone" || input.method === "sms") && !/^0\d{8,10}$/.test(contact.replace(/\D/g, ""))) {
      return { error: "전화번호를 확인해주세요." };
    }
    if (input.method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return { error: "이메일 주소를 확인해주세요." };
    const { error } = await supabase.rpc("admin_set_group_contact", { p_inquiry_id: input.id, p_contact_method: input.method, p_contact: contact });
    if (error) return { error: error.message };
    await addHistory(supabase, input.id, "info", "담당자 연락처 변경");
    await writeAuditLog({ action: "group_booking.contact_changed", targetType: "group_booking_inquiry", targetId: input.id, summary: "단체 담당자 연락처 변경" });
    refresh(input.id);
    return { success: true, message: "연락처를 바꿨습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

// ── 참가자 · 팀 편성 ─────────────────────────────────────────────

/** 참가자 한 명의 전화번호 보기 — 누를 때만 복호화해 내려준다. 누가 언제 봤는지 감사로그에 남긴다(값은 남기지 않는다). */
export async function revealParticipantPhone(input: { id: string; participantId: string }): Promise<{ phone: string } | { error: string }> {
  try {
    const supabase = await requireAdmin();
    if (!UUID.test(input.id) || !UUID.test(input.participantId)) return { error: "참가자를 찾을 수 없습니다." };
    const { data, error } = await supabase
      .from("admin_group_participants_view")
      .select("phone")
      .eq("inquiry_id", input.id)
      .eq("id", input.participantId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "참가자를 찾을 수 없습니다." };
    await writeAuditLog({
      action: "group_booking.contact_viewed",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary: "단체 참가자 전화번호 보기",
      detail: { participant: input.participantId },
    });
    return { phone: dashedPhone(String((data as { phone: string }).phone ?? "")) };
  } catch (err) {
    return toActionError(err, "번호를 불러오지 못했습니다.");
  }
}

/** 참가자 설문에서 전용 칸으로 저장되는 질문들. 나머지는 answers 에 있다. */
const PARTICIPANT_FIXED = new Set(["name", "phone", "nick", "age", "exp", "terms", "privacy", "phoneBox", "photo"]);

function dashedPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d;
}

/** CSV 한 칸 — 따옴표로 싸고, 수식으로 읽힐 수 있는 글자(= + - @)로 시작하면 앞에 작은따옴표를 붙인다. */
function csvCell(v: string | number): string {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * 참가자 명단 CSV — 엑셀에서 바로 열린다(맨 앞에 BOM). 이름 · 전화번호가 들어가는 파일이라 저장할 때마다 감사로그에 남긴다.
 */
export async function exportParticipantsCsv(input: { id: string }): Promise<{ csv: string; fileName: string } | { error: string }> {
  try {
    const { supabase, group } = await open(input.id);
    const mode = await loadNametagMode(input.id);
    const { data, error } = await supabase
      .from("admin_group_participants_view")
      .select("name, phone, nickname, age_band, room_count, consent_photo, submitted_at, edited, answers")
      .eq("inquiry_id", input.id)
      .order("submitted_at", { ascending: true });
    if (error) return { error: error.message };
    const rows = (data ?? []) as {
      name: string;
      phone: string;
      nickname: string;
      age_band: string;
      room_count: number;
      consent_photo: boolean;
      submitted_at: string;
      edited: boolean;
      answers: Answers | null;
    }[];
    if (rows.length === 0) return { error: "아직 참가자 설문 응답이 없습니다." };
    // 양식에 더한 질문(전용 칸이 없는 질문)의 답도 칸으로 붙인다. 지금 양식의 질문 이름을 쓴다.
    const extraQs = flattenTemplate((await loadTemplate("participant")).template).filter((q) => !PARTICIPANT_FIXED.has(q.id));
    const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
    const lines = [
      ["이름", "닉네임", "방탈출 횟수", "명찰 색", "나이대", "전화번호", "사진 홍보 동의", "제출 시각", "비고", ...extraQs.map((q) => q.label)],
      ...rows.map((r) => [
        r.name,
        r.nickname,
        r.room_count,
        nametagColor(r.room_count, mode),
        r.age_band,
        dashedPhone(r.phone),
        r.consent_photo ? "동의" : "미동의",
        kst(r.submitted_at),
        r.edited ? "수정됨" : "",
        ...extraQs.map((q) => {
          const text = answerText(q, r.answers ?? {});
          return text === "-" ? "" : text;
        }),
      ]),
    ];
    await writeAuditLog({
      action: "group_booking.participants_exported",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary: `단체 참가자 명단 CSV 저장 (${rows.length}명)`,
    });
    const name = (group.group_name ?? "단체").replace(/[\\/:*?"<>|\s]+/g, "_");
    return { csv: `\uFEFF${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}`, fileName: `${name}_참가자.csv` };
  } catch (err) {
    return toActionError(err, "명단을 만들지 못했습니다.");
  }
}

/** 「닉네임 · 방수 복사」 를 눌렀다는 기록(값은 화면에 이미 있다 — 여기서는 기록만 남긴다). */
export async function logParticipantsCopied(input: { id: string; count: number }): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!UUID.test(input.id)) return { error: "단체를 찾을 수 없습니다." };
    await writeAuditLog({
      action: "group_booking.participants_copied",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary: `단체 참가자 닉네임 · 방수 복사 (${Math.max(0, Math.trunc(Number(input.count) || 0))}명)`,
    });
    return { success: true };
  } catch (err) {
    return toActionError(err, "기록하지 못했습니다.");
  }
}

/** 명찰 색 기준(초심자 / 숙련자). 참가자 설문의 방수를 보고 운영자가 고른다. */
export async function setNametagMode(input: { id: string; mode: string }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    if (!isNametagMode(input.mode)) return { error: "기준을 다시 골라주세요." };
    const { error } = await supabase.from("group_booking_inquiries").update({ nametag_mode: input.mode }).eq("id", input.id);
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: `명찰 색 기준을 ${input.mode === "beginner" ? "초심자" : "숙련자"}로 바꿨습니다.` };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/**
 * 팀 편성 저장 — 팀 · 팀명 · 구호 · 팀원을 통째로 바꿔 넣는다. null 이면 편성을 지워 「추천 편성」 으로 돌아간다.
 * 그 단체의 참가자가 아니거나 두 팀에 들어 있으면 DB 함수가 통째로 거절한다.
 */
export async function saveTeams(input: { id: string; teams: Team[] | null }): Promise<ActionResult> {
  try {
    const { supabase, group } = await open(input.id);
    if (group.cancelled_at) return { error: "취소된 단체입니다." };
    let payload: { name: string; slogan: string; members: string[] }[] | null = null;
    if (input.teams) {
      if (!Array.isArray(input.teams) || input.teams.length < 1 || input.teams.length > TEAM_MAX) return { error: `팀은 1~${TEAM_MAX}팀까지 둘 수 있습니다.` };
      payload = [];
      for (const t of input.teams) {
        // 화면 · PPT 에 그대로 쓰는 값이라 기호는 막지 않는다. 보이지 않는 글자와 길이만 정리한다.
        const name = cleanLine(t?.name ?? "");
        const slogan = cleanLine(t?.slogan ?? "");
        if (charCount(name) > TEAM_NAME_MAX) return { error: `팀명은 ${TEAM_NAME_MAX}자까지 쓸 수 있어요.` };
        if (charCount(slogan) > TEAM_SLOGAN_MAX) return { error: `팀 구호는 ${TEAM_SLOGAN_MAX}자까지 쓸 수 있어요.` };
        const members = Array.isArray(t?.members) ? t.members.map(String) : [];
        if (members.some((m) => !UUID.test(m))) return { error: "참가자를 찾을 수 없습니다." };
        payload.push({ name, slogan, members });
      }
    }
    const { error } = await supabase.rpc("admin_save_group_teams", { p_inquiry_id: input.id, p_teams: payload });
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: payload ? "저장했습니다." : "추천 편성으로 되돌렸습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

// ── 명찰 제작기 ──────────────────────────────────────────────────

export type NametagOpen = {
  /** 제작기 파일의 임시 주소(5분). 브라우저가 저장소에서 직접 받는다 — 서버를 지나지 않는다. */
  url: string;
  /** 파일이 바뀌면 달라지는 값. 브라우저가 받아 둔 파일을 다시 쓸지 정한다. */
  version: string;
  group: string;
  mode: "beginner" | "experienced";
  edition: "regular" | "christmas" | null;
  people: NametagPerson[];
  /** 저장해 둔 명찰을 불러왔는가. */
  fromSaved: boolean;
  /** 저장한 뒤 들어와 뒤에 더한 설문 응답 수. */
  added: number;
  surveyCount: number;
};

/**
 * 「명찰 만들기」 — 제작기 파일의 임시 주소와 넘길 명단(닉네임 · 방수)을 돌려준다. 이름 · 연락처는 싣지 않는다.
 * 파일은 비공개 버킷에 있어 이 주소 없이는 받을 수 없고, 주소는 5분 뒤에 죽는다.
 */
export async function openNametagMaker(input: { id: string; fresh?: boolean }): Promise<NametagOpen | { error: string }> {
  try {
    const { supabase, group } = await open(input.id);
    const [signed, listed, survey, mode, savedRes] = await Promise.all([
      supabase.storage.from(NAMETAG_BUCKET).createSignedUrl(NAMETAG_FILE, 300),
      supabase.storage.from(NAMETAG_BUCKET).list("", { search: NAMETAG_FILE, limit: 5 }),
      loadTeamPeople(input.id),
      loadNametagMode(input.id),
      supabase.from("group_nametag_states").select("state").eq("inquiry_id", input.id).maybeSingle(),
    ]);
    if (signed.error || !signed.data?.signedUrl) {
      console.error("[group] 명찰 제작기 임시 주소 실패", signed.error?.message);
      return { error: "명찰 제작기 파일을 찾지 못했습니다. 파일이 저장소(admin-tools)에 올라가 있는지 확인해주세요." };
    }
    if (savedRes.error) return { error: savedRes.error.message };
    if (survey.length === 0) return { error: "아직 참가자 설문 응답이 없습니다." };
    const file = (listed.data ?? []).find((f) => f.name === NAMETAG_FILE);
    // 「설문 명단으로 다시 채우기」 는 저장해 둔 것을 쓰지 않는다(다시 저장하기 전까지 저장본은 그대로 있다).
    const saved: NametagState | null = input.fresh ? null : cleanNametagState((savedRes.data as { state?: unknown } | null)?.state);
    const roster = nametagRoster(saved, survey);
    return {
      url: signed.data.signedUrl,
      version: file?.updated_at ?? file?.id ?? "unknown",
      group: group.display_name ?? group.group_name ?? "단체 모임",
      // 저장해 둔 것이 있으면 그때 고른 기준 · 에디션을, 없으면 참가자 탭에서 고른 기준을 쓴다.
      mode: saved ? saved.experience : mode,
      edition: saved ? saved.edition : null,
      people: roster.people,
      fromSaved: roster.fromSaved,
      added: roster.added,
      surveyCount: survey.length,
    };
  } catch (err) {
    return toActionError(err, "명찰 제작기를 열지 못했습니다.");
  }
}

/** 제작기에서 고친 내용(닉네임 · 방수 · 글자 위치 · 크기 · 에디션 · 기준)을 단체별로 저장한다. 설문 원본은 바꾸지 않는다. */
export async function saveNametagState(input: { id: string; state: unknown }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    const state = cleanNametagState(input.state);
    if (!state) return { error: "저장할 내용을 읽지 못했습니다." };
    if (state.people.length === 0) return { error: "명찰이 하나도 없어 저장하지 않았습니다." };
    // 지금 설문에 있는 닉네임을 같이 적어 둔다(서버가 채운다 — 화면이 보낸 값은 쓰지 않는다).
    state.seen = (await loadTeamPeople(input.id)).map((p) => p.nick);
    const { error } = await supabase
      .from("group_nametag_states")
      .upsert({ inquiry_id: input.id, state, updated_at: new Date().toISOString() }, { onConflict: "inquiry_id" });
    if (error) return { error: error.message };
    return { success: true, message: `명찰 ${state.people.length}개를 저장했습니다.` };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

// ── 플레이 리포트 ────────────────────────────────────────────────

export type ReportOpen = {
  /** 리포트 틀 파일의 임시 주소(5분). */
  url: string;
  docId: string;
  group: string;
  /** 저장해 둔 내용(글자 · 팀 · 점수). 없으면 null — fill 로 새로 채운다. */
  saved: ReportState | null;
  fill: ReportFill;
  /** 지금의 팀 편성 — 「팀 편성 다시 가져오기」 에 쓴다. */
  teamsNow: ReportTeam[];
  /** 팀 편성이 저장돼 있는가(아니면 추천 편성이다). */
  teamsSaved: boolean;
};

/**
 * 「리포트 열기」 — 틀 파일의 임시 주소와 채울 값을 돌려준다. 팀원은 닉네임만 싣는다(이름 · 연락처 없음).
 * 일시 · 모임명 · 인원 · 플레이 타임 · 팀은 단체 정보와 팀 편성에서 온다. 모두 리포트에서 고칠 수 있다.
 */
export async function openReport(input: { id: string }): Promise<ReportOpen | { error: string }> {
  try {
    const { supabase, group } = await open(input.id);
    const [signed, people, savedTeams, savedRes, defaultsRow] = await Promise.all([
      supabase.storage.from(NAMETAG_BUCKET).createSignedUrl(REPORT_FILE, 300),
      loadTeamPeople(input.id),
      loadSavedTeams(input.id),
      supabase.from("group_reports").select("state").eq("inquiry_id", input.id).maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", REPORT_DEFAULTS_KEY).maybeSingle(),
    ]);
    const defaultsRes = cleanReportDefaults((defaultsRow.data as { value?: unknown } | null)?.value);
    if (signed.error || !signed.data?.signedUrl) {
      console.error("[group] 리포트 틀 임시 주소 실패", signed.error?.message);
      return { error: "리포트 틀 파일을 찾지 못했습니다. 파일이 저장소(admin-tools)에 올라가 있는지 확인해주세요." };
    }
    if (savedRes.error) return { error: savedRes.error.message };
    const teams = savedTeams ? reconcileTeams(savedTeams, people).teams : people.length ? suggestTeams(people) : [];
    const sch = scheduleOf(group);
    const title = group.display_name ?? group.group_name ?? "";
    return {
      url: signed.data.signedUrl,
      docId: `wye-${input.id}`,
      group: title || "단체 모임",
      saved: cleanReportState((savedRes.data as { state?: unknown } | null)?.state),
      fill: buildReportFill({
        title,
        date: sch.date,
        time: sch.time,
        headcount: group.headcount,
        icebreaking: toSettlementOptions(group.options).icebreaking,
        teams,
        people,
        defaults: "value" in defaultsRes ? defaultsRes.value : undefined,
      }),
      teamsNow: reportTeams(teams, people),
      teamsSaved: !!savedTeams,
    };
  } catch (err) {
    return toActionError(err, "리포트를 열지 못했습니다.");
  }
}

/** 리포트에 적은 내용(글자 · 팀 · 점수 · 꾸밈)을 단체별로 저장한다. 사진은 저장하지 않는다 — cleanReportState 가 걸러낸다. */
export async function saveReportState(input: { id: string; state: unknown }): Promise<ActionResult> {
  try {
    const { supabase } = await open(input.id);
    const state = cleanReportState(input.state);
    if (!state) return { error: "저장할 내용을 읽지 못했습니다." };
    const { error } = await supabase
      .from("group_reports")
      .upsert({ inquiry_id: input.id, state, updated_at: new Date().toISOString() }, { onConflict: "inquiry_id" });
    if (error) return { error: error.message };
    refresh(input.id);
    return { success: true, message: "글자 · 팀 · 점수를 저장했습니다. 사진은 저장되지 않습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}
