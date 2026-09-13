import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { loadPreviewThemes } from "@/lib/templatePreview";
import { SlackTemplateList } from "./SlackTemplateList";

export const dynamic = "force-dynamic";

export default async function SlackTemplatesPage() {
  const supabase = createAdminClient();

  const [{ data: templates, error }, themes] = await Promise.all([
    supabase
      .from("slack_templates")
      .select("key, label, body, placeholders, updated_at")
      .order("label", { ascending: true }),
    loadPreviewThemes(),
  ]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/slack-templates" />

        <header className="mb-6">
          <h1 className="mb-2 text-2xl font-bold">슬랙 포맷 관리</h1>
          <p className="text-sm text-muted">
            슬랙으로 나가는 알림 문구입니다. 본문에 {"{{변수}}"} 를 넣으면 발송 시 실제 값으로
            바뀌고, {"{{#attendees}} … {{/attendees}}"} 블록은 참여자 수만큼 반복됩니다. 저장 즉시
            다음 알림부터 적용됩니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">슬랙 템플릿을 불러올 수 없습니다: {error.message}</div>
        ) : templates && templates.length > 0 ? (
          <SlackTemplateList
            themes={themes}
            templates={templates.map((t) => ({
              key: t.key as string,
              label: t.label as string,
              body: t.body as string,
              placeholders: (t.placeholders as string[]) ?? [],
              updatedAt: new Date(t.updated_at as string).toLocaleString("ko-KR"),
            }))}
          />
        ) : (
          <div className="py-8 text-center text-muted">등록된 템플릿이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
