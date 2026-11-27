import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPTION, dateLabel } from "@/lib/groupPricing";
import { EVENT_ITEM_PREFIX, eventChecklistLabel, parsePending, type LeaderGroupNow, type PendingItem } from "@/lib/groupForms/leaderForm";
import type { Answers } from "@/lib/groupForms/validate";
import { maskContact, maskName, scheduleOf, type GroupCore } from "@/lib/groupStage";

/**
 * 모임장 신청서 — 서버가 읽는 길(관리자 개편 5단계 둘째 묶음).
 *
 * ⚠️ 이름 · 연락처 전체는 이 파일 밖으로 나가지 않는다. 공개 폼에는 **가린 값**(김*윤 · 010-****-1234)만 내려보낸다.
 * ⚠️ 제출된 답은 공개 폼에 그냥 내려보내지 않는다 — 휴대폰 번호 끝 4자리를 확인한 뒤에만(leaderActions.ts).
 */

/** 공개 폼의 확인 화면에 내려가는 값. 견적에서 받은 것 + 가린 담당자. */
export type LeaderPrefill = {
  groupName: string | null;
  headcount: number;
  /** 모임 성격 코드(GROUP_KINDS). */
  groupKind: string | null;
  groupKindNote: string | null;
  date: string | null;
  time: string | null;
  /** 예약금이 들어와 일정이 확정됐는가. */
  fixed: boolean;
  afterPartyHours: number;
  cleanup: boolean;
  /** 가린 담당자 이름('김*윤'). 없으면 null. */
  organizer: string | null;
  /** 단체 연락처가 휴대폰 번호면 가린 값('010-****-1234') — 있으면 번호를 다시 묻지 않는다. */
  phoneMasked: string | null;
  /** new: 아직 안 냄 · submitted: 냈고 잠김 · reopened: 운영자가 수정을 열어 줌 */
  state: "new" | "submitted" | "reopened";
  /** 낸 날('12월 3일 (목)'). */
  submittedOn: string | null;
};

type InquiryRow = GroupCore & {
  group_name: string | null;
  headcount: number;
  group_kind: string | null;
  group_kind_note: string | null;
  organizer_name: string | null;
  contact: string | null;
  contact_method: string;
};

async function readInquiry(inquiryId: string): Promise<InquiryRow | null> {
  const { data, error } = await createAdminClient()
    .from("admin_group_booking_inquiries_view")
    .select(
      "group_name, headcount, group_kind, group_kind_note, organizer_name, contact, contact_method, stage, cancelled_at, deposit_amount, deposit_paid_at, balance_paid_at, event_date, event_time, event_minutes, preferred_date, preferred_time, options"
    )
    .eq("id", inquiryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as InquiryRow | null) ?? null;
}

/** 지금 값(견적과 비교할 기준). */
export function groupNowOf(g: GroupCore & { headcount: number }): LeaderGroupNow {
  const sch = scheduleOf(g);
  return {
    headcount: g.headcount,
    date: sch.date,
    time: sch.time,
    fixed: g.deposit_paid_at != null,
    afterPartyHours: Math.max(0, Math.min(OPTION.afterParty.maxHours, Math.trunc(g.options?.after_party_hours ?? 0))),
    cleanup: !!g.options?.cleanup,
  };
}

/** 휴대폰 번호(010 + 8자리)인가. */
const isMobile = (method: string, contact: string | null) =>
  (method === "phone" || method === "sms") && /^010\d{8}$/.test((contact ?? "").replace(/\D/g, ""));

/** 공개 폼의 첫 화면용. 단체가 없으면 null. */
export async function loadLeaderPrefill(inquiryId: string): Promise<{ prefill: LeaderPrefill; now: LeaderGroupNow } | null> {
  const supabase = createAdminClient();
  const [g, res] = await Promise.all([
    readInquiry(inquiryId),
    supabase.from("group_leader_responses").select("locked, submitted_at").eq("inquiry_id", inquiryId).maybeSingle(),
  ]);
  if (res.error) throw new Error(res.error.message);
  if (!g) return null;
  const now = groupNowOf(g);
  const row = res.data as { locked: boolean; submitted_at: string } | null;
  return {
    now,
    prefill: {
      groupName: g.group_name,
      headcount: g.headcount,
      groupKind: g.group_kind,
      groupKindNote: g.group_kind_note,
      date: now.date,
      time: now.time,
      fixed: now.fixed,
      afterPartyHours: now.afterPartyHours,
      cleanup: now.cleanup,
      organizer: g.organizer_name ? maskName(g.organizer_name) : null,
      phoneMasked: isMobile(g.contact_method, g.contact) ? maskContact("phone", g.contact) : null,
      state: !row ? "new" : row.locked ? "submitted" : "reopened",
      submittedOn: row ? dateLabel(new Date(new Date(row.submitted_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)) : null,
    },
  };
}

/** 관리자 화면용 신청서. 휴대폰 번호 · 새 담당자 이름은 가려서 준다. */
export type LeaderResponse = {
  answers: Answers;
  templateVersion: number;
  phoneMasked: string;
  /** 「담당자가 바뀌었어요」 로 적은 새 이름(가린 값). 없으면 null. */
  newLeaderMasked: string | null;
  submittedAt: string;
  updatedAt: string;
  submitCount: number;
  locked: boolean;
  editRequest: string | null;
  editRequestedAt: string | null;
  pending: PendingItem[];
  adminUpdatedBy: string | null;
  adminUpdatedAt: string | null;
};

type ViewRow = {
  inquiry_id: string;
  answers: Answers;
  template_version: number;
  phone: string;
  leader_name: string | null;
  submitted_at: string;
  updated_at: string;
  submit_count: number;
  locked: boolean;
  edit_request: string | null;
  edit_requested_at: string | null;
  pending: unknown;
  admin_updated_by: string | null;
  admin_updated_at: string | null;
};

export async function loadLeaderResponse(inquiryId: string): Promise<LeaderResponse | null> {
  const { data, error } = await createAdminClient().from("admin_group_leader_responses_view").select("*").eq("inquiry_id", inquiryId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as ViewRow;
  return {
    answers: r.answers ?? {},
    templateVersion: r.template_version,
    phoneMasked: maskContact("phone", r.phone),
    newLeaderMasked: r.leader_name ? maskName(r.leader_name) : null,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
    submitCount: r.submit_count,
    locked: r.locked,
    editRequest: r.edit_request,
    editRequestedAt: r.edit_requested_at,
    pending: parsePending(r.pending),
    adminUpdatedBy: r.admin_updated_by,
    adminUpdatedAt: r.admin_updated_at,
  };
}

/** 답만 읽는다(공개 폼에서 끝 4자리를 확인한 뒤 · 체크리스트 맞추기). 암호화 칸은 읽지 않는다. */
export async function loadLeaderAnswers(
  inquiryId: string
): Promise<{ answers: Answers; locked: boolean; editRequest: string | null; templateVersion: number } | null> {
  const { data, error } = await createAdminClient()
    .from("group_leader_responses")
    .select("answers, locked, edit_request, template_version")
    .eq("inquiry_id", inquiryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as { answers: Answers; locked: boolean; edit_request: string | null; template_version: number };
  return { answers: r.answers ?? {}, locked: r.locked, editRequest: r.edit_request, templateVersion: r.template_version };
}

/**
 * 신청서의 이벤트를 준비 체크리스트에 맞춘다 — 이벤트가 있으면 `이벤트 준비: …` 한 줄을 넣고(이미 있으면 글만 고친다),
 * 체크리스트가 아직 없으면(확정 전) 아무것도 하지 않는다. 체크리스트를 만들 때 한 번 더 불린다.
 * 이벤트가 없어졌다고 줄을 지우지는 않는다 — 운영자가 이미 준비를 시작했을 수 있다.
 */
export async function syncEventChecklist(inquiryId: string): Promise<void> {
  const supabase = createAdminClient();
  const res = await loadLeaderAnswers(inquiryId);
  const label = res ? eventChecklistLabel(res.answers) : null;
  if (!label) return;
  const { data, error } = await supabase.from("group_checklist_items").select("id, idx, label").eq("inquiry_id", inquiryId);
  if (error) throw new Error(error.message);
  const items = (data ?? []) as { id: string; idx: number; label: string }[];
  if (items.length === 0) return;
  const existing = items.find((i) => i.label.startsWith(EVENT_ITEM_PREFIX));
  if (existing) {
    if (existing.label !== label) await supabase.from("group_checklist_items").update({ label }).eq("id", existing.id);
    return;
  }
  if (items.length >= 50) return;
  const idx = Math.min(999, items.reduce((m, i) => Math.max(m, i.idx), -1) + 1);
  const ins = await supabase.from("group_checklist_items").insert({ inquiry_id: inquiryId, idx, label });
  if (ins.error) throw new Error(ins.error.message);
}
