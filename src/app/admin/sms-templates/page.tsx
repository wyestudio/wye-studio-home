import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SmsTemplateEditor } from "./SmsTemplateEditor";

export const dynamic = "force-dynamic";

export default async function SmsTemplatesPage() {
  const supabase = createAdminClient();

  const { data: templates, error } = await supabase
    .from("sms_templates")
    .select("key, label, body, placeholders, updated_at")
    .order("label", { ascending: true });

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">문자 템플릿을 불러올 수 없습니다: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="text-glow hover:underline mb-4 inline-block">
          ← 돌아가기
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">문자 포맷 관리</h1>
          <p className="text-muted">
            본문에 {"{{변수}}"} 형태로 플레이스홀더를 넣으면 발송 시 실제 값으로 치환됩니다. 변경사항은 저장 즉시 다음 발송부터 적용됩니다.
          </p>
        </div>

        <div className="space-y-4">
          {templates && templates.length > 0 ? (
            templates.map((t) => (
              <SmsTemplateEditor
                key={t.key}
                templateKey={t.key}
                label={t.label}
                initialBody={t.body}
                placeholders={t.placeholders ?? []}
                updatedAt={new Date(t.updated_at).toLocaleString("ko-KR")}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted">등록된 템플릿이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
