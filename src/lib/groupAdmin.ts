import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { kstToday } from "@/lib/groupPricing";
import { calcSettlement, daysBetween, type Adjustment, type AdjustReason, type Settlement } from "@/lib/groupSettlement";
import { syncEventChecklist } from "@/lib/groupLeader";
import { scheduleOf, toSettlementOptions, type GroupCore } from "@/lib/groupStage";

/**
 * 단체 예약 — 어드민 서버가 읽는 길(관리자 개편 4단계).
 *
 * ⚠️ **연락처는 여기서 읽지 않는다.** 목록 · 상세가 받는 줄에는 연락처가 없고, 상세의 「연락처 보기」 를
 *    눌렀을 때만 서버 액션(revealContact)이 따로 복호화해 내려준다(누른 기록을 감사로그에 남긴다).
 *    담당자 이름은 서버에서 가려서(maskName) 넘긴다.
 * ⚠️ 금액은 저장돼 있지 않다. 재료(인원 · 일시 · 옵션 · 학생 인원 · 조정 줄 · 받은 예약금)로 여기서 계산한다.
 */

/** 뷰(admin_group_booking_inquiries_view)에서 읽는 칸 — contact 는 일부러 뺐다. */
export const GROUP_COLUMNS =
  "id, created_at, updated_at, headcount, contact_method, preferred_date, preferred_time, group_kind, group_kind_note, note, " +
  "utm_source, utm_medium, utm_campaign, referrer, landing_path, status, admin_memo, organizer_name, group_name, options, " +
  "unit_price, estimate_total, team_style, repeat_player, occasion, stage, event_date, event_time, event_minutes, " +
  "is_student_group, student_count, pay_type, deposit_amount, deposit_paid_at, balance_paid_at, deposit_returned_at, " +
  "cancelled_at, cancel_reason, refund_amount, display_name, welcome_text, source, messages_copied";

export type GroupRow = GroupCore & {
  id: string;
  created_at: string;
  updated_at: string;
  headcount: number;
  contact_method: string;
  group_kind: string | null;
  group_kind_note: string | null;
  note: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  status: string;
  admin_memo: string | null;
  /** 복호화된 담당자 이름 — 서버 안에서만 쓴다(검색 · 가림). 화면에는 maskName 한 값만 넘긴다. */
  organizer_name: string | null;
  group_name: string | null;
  unit_price: number | null;
  estimate_total: number | null;
  team_style: string | null;
  repeat_player: string | null;
  occasion: string | null;
  is_student_group: boolean;
  student_count: number | null;
  pay_type: string;
  deposit_returned_at: string | null;
  cancel_reason: string | null;
  refund_amount: number | null;
  display_name: string | null;
  welcome_text: string | null;
  source: string;
  messages_copied: Record<string, string>;
};

export type AdjustmentRow = {
  id: string;
  inquiry_id: string;
  reason_code: AdjustReason;
  label: string;
  amount: number | null;
  pct: number | null;
  sign: 1 | -1;
  note: string | null;
  created_at: string;
};

export type HistoryRow = {
  id: number;
  kind: string;
  summary: string;
  reason: string | null;
  actor: string;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  idx: number;
  label: string;
  owner: string | null;
  done_at: string | null;
  auto: boolean;
};

export const toAdjustment = (r: AdjustmentRow): Adjustment => ({
  reason: r.reason_code,
  label: r.label,
  amount: r.amount,
  // numeric 은 문자열로 온다
  pct: r.pct == null ? null : Number(r.pct),
  sign: r.sign,
});

/** 이 단체의 정산. 날짜가 없으면(옛 접수분) 오늘로 계산한다 — 요금 시기를 알 수 없어서다. */
export function settlementFor(g: GroupRow, adjustments: readonly AdjustmentRow[], today: string = kstToday()): Settlement {
  return calcSettlement({
    date: scheduleOf(g).date ?? today,
    headcount: g.headcount,
    options: toSettlementOptions(g.options),
    studentCount: g.is_student_group ? (g.student_count ?? 0) : null,
    adjustments: adjustments.map(toAdjustment),
    depositPaid: g.deposit_amount,
  });
}

/** 행사일까지 남은 날. 날짜가 없으면 null. */
export function daysLeftOf(g: GroupRow, today: string): number | null {
  const d = scheduleOf(g).date;
  return d ? daysBetween(today, d) : null;
}

/** 목록용 — 전체 단체와 조정 줄. 건수가 적어(수백 건) 한 번에 읽고 서버에서 거른다. */
export async function loadGroups(): Promise<{ rows: GroupRow[]; adjustments: Map<string, AdjustmentRow[]> }> {
  const supabase = createAdminClient();
  const [g, a] = await Promise.all([
    supabase.from("admin_group_booking_inquiries_view").select(GROUP_COLUMNS).order("created_at", { ascending: false }),
    supabase.from("group_booking_adjustments").select("*").order("created_at", { ascending: true }),
  ]);
  // 조회 실패를 0건으로 보여주지 않는다 — 금액 화면에서 0건은 "받을 돈이 없다" 로 읽힌다.
  if (g.error) throw new Error(g.error.message);
  if (a.error) throw new Error(a.error.message);
  const adjustments = new Map<string, AdjustmentRow[]>();
  for (const r of (a.data ?? []) as AdjustmentRow[]) {
    adjustments.set(r.inquiry_id, [...(adjustments.get(r.inquiry_id) ?? []), r]);
  }
  return { rows: (g.data ?? []) as unknown as GroupRow[], adjustments };
}

/** 상세용 — 한 단체와 조정 줄 · 변경 기록. 없으면 null. */
export async function loadGroup(
  id: string
): Promise<{ group: GroupRow; adjustments: AdjustmentRow[]; history: HistoryRow[]; checklist: ChecklistItem[] } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  const supabase = createAdminClient();
  const [g, a, h, c] = await Promise.all([
    supabase.from("admin_group_booking_inquiries_view").select(GROUP_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("group_booking_adjustments").select("*").eq("inquiry_id", id).order("created_at", { ascending: true }),
    supabase
      .from("group_booking_history")
      .select("id, kind, summary, reason, actor, created_at")
      .eq("inquiry_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("group_checklist_items")
      .select("id, idx, label, owner, done_at, auto")
      .eq("inquiry_id", id)
      .order("idx", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (g.error) throw new Error(g.error.message);
  if (a.error) throw new Error(a.error.message);
  if (h.error) throw new Error(h.error.message);
  if (c.error) throw new Error(c.error.message);
  if (!g.data) return null;
  return {
    group: g.data as unknown as GroupRow,
    adjustments: (a.data ?? []) as AdjustmentRow[],
    history: (h.data ?? []) as HistoryRow[],
    checklist: (c.data ?? []) as ChecklistItem[],
  };
}

/** 단체용 안내 문자 문구 원본(sms_templates 의 group_*). 키 → 본문. */
export async function loadGroupTemplates(): Promise<Map<string, string>> {
  const { data, error } = await createAdminClient().from("sms_templates").select("key, body").like("key", "group_%");
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as { key: string; body: string }[]).map((r) => [r.key, r.body]));
}

/**
 * 준비 체크리스트를 양식에서 복사해 만든다 — 단체가 확정될 때 한 번. 이미 있으면 아무것도 하지 않는다.
 * 양식을 나중에 고쳐도 이미 만들어진 단체의 체크리스트는 바뀌지 않는다.
 */
export async function createChecklistIfMissing(id: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase.from("group_checklist_items").select("id", { count: "exact", head: true }).eq("inquiry_id", id);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return 0;
  const { data: tpl, error: tplErr } = await supabase.from("group_checklist_templates").select("idx, label, owner").order("idx");
  if (tplErr) throw new Error(tplErr.message);
  const rows = ((tpl ?? []) as { idx: number; label: string; owner: string | null }[]).map((t) => ({ inquiry_id: id, idx: t.idx, label: t.label, owner: t.owner }));
  if (rows.length === 0) return 0;
  const { error: insErr } = await supabase.from("group_checklist_items").insert(rows);
  if (insErr) throw new Error(insErr.message);
  // 모임장 신청서에 이벤트가 적혀 있으면 `이벤트 준비: …` 줄을 같이 넣는다. 못 넣어도 체크리스트 만들기를 실패로 돌리지 않는다.
  try {
    await syncEventChecklist(id);
  } catch (err) {
    console.error("[group] 이벤트 체크리스트 줄 추가 실패", err);
  }
  return rows.length;
}
