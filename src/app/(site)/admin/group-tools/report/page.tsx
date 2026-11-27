import { AdminPage } from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_DEFAULTS_KEY, cleanReportDefaults, REPORT_DEFAULTS_BASE } from "@/lib/groupToolRules";
import { ReportDefaultsEditor } from "./ReportDefaultsEditor";

export const dynamic = "force-dynamic";

/**
 * 단체 도구 › 플레이 리포트(관리자 개편 7단계) — 리포트를 **새로 만들 때** 채우는 기본 문구와 게임 이름.
 * 이미 저장해 둔 리포트는 바뀌지 않는다. 리포트 틀 파일 자체는 비공개 저장소에 있고, 바꾸는 절차는
 * docs/RUNBOOK-group-leader-form-release.md 에 있다(틀에 실제 단체의 사진이 들어 있을 수 있어 화면에서 올리지 않는다).
 */
export default async function ReportDefaultsPage() {
  const { data, error } = await createAdminClient().from("site_settings").select("value").eq("key", REPORT_DEFAULTS_KEY).maybeSingle();
  const res = cleanReportDefaults((data as { value?: unknown } | null)?.value);
  const value = "value" in res ? res.value : REPORT_DEFAULTS_BASE;
  return (
    <AdminPage
      title="플레이 리포트"
      description="리포트를 새로 만들 때 채우는 기본 문구와 게임 이름입니다. 단체마다 리포트 안에서 다시 고칠 수 있고, 이미 저장해 둔 리포트는 바뀌지 않아요."
    >
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          기본값을 불러오지 못했습니다: {error.message}
        </p>
      ) : (
        <ReportDefaultsEditor initial={value} />
      )}
    </AdminPage>
  );
}
