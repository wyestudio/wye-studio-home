import { AdminPage, AdminTabs } from "@/components/admin/ui";
import { formatDateTimeFull } from "@/lib/format";
import { FORM_KEYS, isFormKey, lockedIds } from "@/lib/groupForms/template";
import { listTemplateVersions, loadTemplate } from "@/lib/groupFormTemplates";
import { FormTemplateEditor } from "./FormTemplateEditor";

export const dynamic = "force-dynamic";

/**
 * 단체 도구 › 설문 양식(관리자 개편 docs/04 5장) — 폼 3벌을 구글폼처럼 고친다.
 *
 * 저장하면 새 버전이 되어 공개 폼에 바로 반영된다. 이미 받은 답은 그때의 버전으로 읽는다.
 * 잠긴 질문(시스템이 값을 쓰는 질문)은 문구만 고칠 수 있다 — 규칙은 groupForms/template.ts 에 있다.
 */
export default async function FormTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const key = typeof sp.form === "string" && isFormKey(sp.form) ? sp.form : "leader";
  const [loaded, versions] = await Promise.all([loadTemplate(key), listTemplateVersions(key)]);

  return (
    <AdminPage
      title="설문 양식"
      description="단체마다 링크는 따로지만 양식은 모든 단체가 같이 씁니다. 저장하면 공개 폼에 바로 반영되고, 이미 받은 답은 그때의 양식으로 그대로 읽힙니다."
    >
      <AdminTabs current={key} tabs={FORM_KEYS.map((f) => ({ key: f.key, label: f.label, href: `/group-tools/forms?form=${f.key}` }))} />
      <FormTemplateEditor
        // 탭을 바꾸거나 저장해 버전이 바뀌면 편집 상태를 새로 시작한다.
        key={`${key}-${loaded.version}`}
        formKey={key}
        version={loaded.version}
        savedAt={loaded.savedAt ? formatDateTimeFull(loaded.savedAt) : null}
        initial={loaded.template}
        locked={[...lockedIds(key)]}
        versions={versions.map((v) => ({ version: v.version, note: v.note, at: v.at ? formatDateTimeFull(v.at) : null }))}
      />
    </AdminPage>
  );
}
