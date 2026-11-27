"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { REPORT_DEFAULTS_KEY, cleanChecklistTemplate, cleanReportDefaults, groupMessageError } from "@/lib/groupToolRules";

/**
 * 단체 도구(관리자 개편 7단계) — 안내 문자 문구 · 체크리스트 양식 · 리포트 기본값.
 *
 * ⚠️ 여기서 고치는 것은 **앞으로 쓸 원본**이다. 이미 만들어진 단체의 체크리스트 · 저장해 둔 리포트는 바뀌지 않는다.
 * ⚠️ 안내 문자는 보내는 문자가 아니다 — 운영자가 복사해 카카오톡에 붙여넣는 문구다. 발송 코드를 부르지 않는다.
 */

/** 단체 안내 문자 문구 저장. 모르는 치환값이 있으면 문자에 {{이름}} 이 그대로 찍히므로 저장하지 않는다. */
export async function updateGroupMessage(key: string, body: string): Promise<{ error?: string; success?: true }> {
  try {
    const supabase = await requireAdmin();
    if (!/^group_[a-z0-9_]{1,40}$/.test(String(key))) return { error: "문구를 찾을 수 없습니다." };
    const text = String(body ?? "").replace(/\r\n?/g, "\n");
    const bad = groupMessageError(text);
    if (bad) return { error: bad };
    // 고치기 전 본문을 남긴다 — 잘못 고쳤을 때 감사로그에서 되살린다.
    const { data: before, error: readErr } = await supabase.from("sms_templates").select("body").eq("key", key).maybeSingle();
    if (readErr) return { error: readErr.message };
    if (!before) return { error: "문구를 찾을 수 없습니다." };
    const { error } = await supabase.from("sms_templates").update({ body: text, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) return { error: `저장 실패: ${error.message}` };
    await writeAuditLog({
      action: "sms_template.updated",
      targetType: "sms_template",
      targetId: key,
      summary: `단체 안내 문자 문구 수정 — ${key}`,
      detail: { previous_body: (before as { body: string }).body, new_length: text.length },
    });
    revalidatePath("/admin/group-tools/messages");
    return { success: true };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/**
 * 체크리스트 양식 저장 — 목록 전체를 바꿔 넣는다. 단체가 확정될 때 이 양식을 복사해 그 단체의 체크리스트를 만든다.
 * 새 줄을 먼저 넣고 옛 줄을 지운다 — 중간에 실패해도 양식이 비어 버리지 않게.
 */
export async function saveChecklistTemplate(input: { items: unknown }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const res = cleanChecklistTemplate(input.items);
    if ("error" in res) return res;
    const { data: old, error: readErr } = await supabase.from("group_checklist_templates").select("id");
    if (readErr) return { error: readErr.message };
    if (res.items.length) {
      const { error } = await supabase
        .from("group_checklist_templates")
        .insert(res.items.map((it, idx) => ({ idx, label: it.label, owner: it.owner || null })));
      if (error) return { error: error.message };
    }
    const ids = ((old ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length) {
      const { error } = await supabase.from("group_checklist_templates").delete().in("id", ids);
      if (error) return { error: `새 양식은 넣었지만 옛 줄을 지우지 못했습니다(${error.message}). 화면을 새로고침해 겹친 줄을 확인해주세요.` };
    }
    await writeAuditLog({
      action: "group_booking.updated",
      targetType: "group_booking_inquiry",
      targetId: "checklist-template",
      summary: `단체 체크리스트 양식 수정 (${res.items.length}줄)`,
    });
    revalidatePath("/admin/group-tools/checklist");
    return { success: true, message: `양식 ${res.items.length}줄을 저장했습니다. 앞으로 확정되는 단체부터 적용됩니다.` };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 플레이 리포트 기본값 저장 — 새로 만드는 리포트에 채워지는 문구와 게임 이름. 이미 저장해 둔 리포트는 바뀌지 않는다. */
export async function saveReportDefaults(input: { value: unknown }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const res = cleanReportDefaults(input.value, true);
    if ("error" in res) return res;
    if (!res.value.games.length) return { error: "게임을 하나 이상 넣어주세요." };
    const { error } = await supabase.from("site_settings").upsert(
      {
        key: REPORT_DEFAULTS_KEY,
        value: res.value,
        description: "단체 플레이 리포트를 새로 만들 때 채우는 기본 문구와 게임 이름",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) return { error: error.message };
    await writeAuditLog({
      action: "group_booking.updated",
      targetType: "group_booking_inquiry",
      targetId: "report-defaults",
      summary: "단체 플레이 리포트 기본값 수정",
    });
    revalidatePath("/admin/group-tools/report");
    return { success: true, message: "저장했습니다. 새로 만드는 리포트부터 적용됩니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}
