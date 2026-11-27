import { AdminPage } from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChecklistTemplateEditor } from "./ChecklistTemplateEditor";

export const dynamic = "force-dynamic";

/**
 * 단체 도구 › 체크리스트 양식(관리자 개편 7단계).
 * 단체가 확정될 때(예약금 입금 확인) 이 양식을 복사해 그 단체의 준비 체크리스트를 만든다.
 * 양식을 고쳐도 이미 만들어진 단체의 체크리스트는 바뀌지 않는다.
 */
export default async function ChecklistTemplatePage() {
  const { data, error } = await createAdminClient().from("group_checklist_templates").select("id, idx, label, owner").order("idx").order("created_at");
  const items = ((data ?? []) as { id: string; label: string; owner: string | null }[]).map((r) => ({ label: r.label, owner: r.owner ?? "" }));
  return (
    <AdminPage
      title="체크리스트 양식"
      description="단체가 확정되면 이 양식을 복사해 그 단체의 준비 체크리스트를 만듭니다. 고쳐도 이미 만들어진 단체의 체크리스트는 바뀌지 않아요."
    >
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          양식을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <ChecklistTemplateEditor initial={items} />
      )}
    </AdminPage>
  );
}
