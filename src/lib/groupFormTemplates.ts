import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultTemplate, validateTemplate, type FormKey, type FormTemplate } from "@/lib/groupForms/template";

/**
 * 단체 설문 양식 — 서버가 읽는 길(관리자 개편 7단계).
 *
 * 버전 1 은 코드의 기본 양식이고, 운영자가 고친 버전은 group_form_templates 에 쌓인다. 가장 큰 버전이 지금 쓰는 양식이다.
 * 읽을 때마다 규칙(validateTemplate)을 다시 통과시킨다 — DB 에 있던 값이 지금 코드의 잠긴 질문 규칙과 어긋나면
 * (코드에서 잠긴 질문이 늘었을 때 등) 잠긴 부분은 코드의 것으로 맞춰지고, 그래도 안 되면 기본 양식으로 떨어진다.
 * 폼이 깨져 접수를 못 받는 쪽이 더 나쁘다.
 */

export type LoadedTemplate = { version: number; template: FormTemplate; savedAt: string | null };

function settle(key: FormKey, version: number, schema: unknown, savedAt: string | null): LoadedTemplate {
  const res = validateTemplate(key, schema);
  if ("template" in res) return { version, template: res.template, savedAt };
  console.error(`[group-form] ${key} 양식 버전 ${version} 을 읽지 못해 기본 양식을 씁니다: ${res.error}`);
  return { version, template: defaultTemplate(key), savedAt };
}

/** 지금 쓰는 양식. */
export async function loadTemplate(key: FormKey): Promise<LoadedTemplate> {
  const { data, error } = await createAdminClient()
    .from("group_form_templates")
    .select("version, schema, created_at")
    .eq("form_key", key)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // 양식 표를 못 읽어도(일시 오류 · 마이그레이션 전) 폼은 기본 양식으로 연다 — 접수를 못 받는 쪽이 더 나쁘다.
    console.error(`[group-form] ${key} 양식을 읽지 못해 기본 양식을 씁니다: ${error.message}`);
    return { version: 1, template: defaultTemplate(key), savedAt: null };
  }
  if (!data) return { version: 1, template: defaultTemplate(key), savedAt: null };
  const row = data as { version: number; schema: unknown; created_at: string };
  return settle(key, row.version, row.schema, row.created_at);
}

/** 그때의 양식 — 받은 답을 읽을 때 쓴다. 그 버전이 없으면 지금 양식. */
export async function loadTemplateVersion(key: FormKey, version: number): Promise<LoadedTemplate> {
  if (!Number.isInteger(version) || version <= 1) return { version: 1, template: defaultTemplate(key), savedAt: null };
  const { data, error } = await createAdminClient()
    .from("group_form_templates")
    .select("version, schema, created_at")
    .eq("form_key", key)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return loadTemplate(key);
  const row = data as { version: number; schema: unknown; created_at: string };
  return settle(key, row.version, row.schema, row.created_at);
}

/** 버전 기록(최근 것부터). 버전 1(기본 양식)은 맨 끝에 붙인다. */
export async function listTemplateVersions(key: FormKey): Promise<{ version: number; note: string | null; at: string | null }[]> {
  const { data, error } = await createAdminClient()
    .from("group_form_templates")
    .select("version, note, created_at")
    .eq("form_key", key)
    .order("version", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as { version: number; note: string | null; created_at: string }[]).map((r) => ({ version: r.version, note: r.note, at: r.created_at }));
  return [...rows, { version: 1, note: "처음 양식", at: null }];
}
