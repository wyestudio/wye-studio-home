"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { REPORT_DEFAULTS_KEY, cleanChecklistTemplate, cleanReportDefaults, groupMessageError } from "@/lib/groupToolRules";
import { FORM_KEYS, isFormKey, validateTemplate } from "@/lib/groupForms/template";
import { loadTemplate, loadTemplateVersion } from "@/lib/groupFormTemplates";

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

/**
 * 설문 양식 저장 — 새 버전으로 쌓는다(예전 버전은 지우지 않는다). 저장하면 공개 폼에 **바로** 반영된다(2026-11-27 대표님).
 * 이미 받은 답은 그때의 버전 번호와 함께 보관돼 있어 그대로 읽힌다.
 *
 * ⚠️ 화면이 보낸 양식을 그대로 넣지 않는다. validateTemplate 이 아는 칸만 옮겨 담고, 잠긴 질문은 코드의 구조로 되돌린다.
 * @param baseVersion 화면이 고치기 시작한 버전 — 그 사이 다른 사람이 먼저 저장했으면 덮어쓰지 않는다.
 */
export async function saveFormTemplate(input: { formKey: string; template: unknown; baseVersion: number; note?: string }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (!isFormKey(input.formKey)) return { error: "양식을 찾을 수 없습니다." };
    const res = validateTemplate(input.formKey, input.template);
    if ("error" in res) return res;
    const current = await loadTemplate(input.formKey);
    if (current.version !== input.baseVersion) {
      return { error: `그 사이 다른 곳에서 양식이 저장됐습니다(버전 ${current.version}). 화면을 새로고침한 뒤 다시 고쳐주세요.` };
    }
    if (JSON.stringify(current.template) === JSON.stringify(res.template)) return { error: "바뀐 내용이 없습니다." };
    const version = current.version + 1;
    const note = String(input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
    const { error } = await supabase.from("group_form_templates").insert({ form_key: input.formKey, version, schema: res.template, note });
    if (error) {
      // 같은 버전 번호를 둘이 동시에 넣으려 한 경우.
      if (error.code === "23505") return { error: "그 사이 다른 곳에서 양식이 저장됐습니다. 화면을 새로고침한 뒤 다시 고쳐주세요." };
      return { error: error.message };
    }
    const label = FORM_KEYS.find((f) => f.key === input.formKey)?.label ?? input.formKey;
    await writeAuditLog({
      action: "group_booking.updated",
      targetType: "group_booking_inquiry",
      targetId: `form-template:${input.formKey}`,
      summary: `단체 설문 양식 수정 — ${label} 버전 ${version}`,
      detail: { form: input.formKey, version, note },
    });
    revalidatePath("/admin/group-tools/forms");
    return { success: true, message: `버전 ${version} 으로 저장했습니다. 공개 폼에 바로 반영됩니다.` };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/** 예전 버전으로 되돌리기 — 그 버전의 내용으로 **새 버전**을 만든다(기록은 지워지지 않는다). */
export async function restoreFormTemplate(input: { formKey: string; version: number }): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!isFormKey(input.formKey) || !Number.isInteger(input.version) || input.version < 1) return { error: "버전을 찾을 수 없습니다." };
    const [current, old] = await Promise.all([loadTemplate(input.formKey), loadTemplateVersion(input.formKey, input.version)]);
    if (old.version !== input.version) return { error: "그 버전을 찾을 수 없습니다." };
    if (current.version === input.version) return { error: "지금 쓰는 버전입니다." };
    return await saveFormTemplate({
      formKey: input.formKey,
      template: old.template,
      baseVersion: current.version,
      note: `버전 ${input.version}${input.version === 1 ? "(처음 양식)" : ""} 으로 되돌림`,
    });
  } catch (err) {
    return toActionError(err, "되돌리지 못했습니다.");
  }
}
