import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
import { loadPreviewThemes } from "@/lib/templatePreview";
import { TemplateList } from "./TemplateList";

export const dynamic = "force-dynamic";

export default async function SmsTemplatesPage() {
  const supabase = createAdminClient();

  const [{ data: templates, error }, themes] = await Promise.all([
    supabase
      .from("sms_templates")
      .select("key, label, body, placeholders, updated_at")
      // 단체 예약 안내 문구(group_*)는 여기 넣지 않는다 — 발송하는 문자가 아니라 복사해서 쓰는 문구다.
      // 이 화면의 "발송 시 치환됩니다" 안내와 맞지 않아, 단체 도구 › 안내 문자 템플릿(/group-tools/messages)에서 따로 고친다.
      .not("key", "like", "group_%")
      .order("label", { ascending: true }),
    loadPreviewThemes(),
  ]);

  if (error) {
    return (
      <AdminPage title="문자 포맷 관리">
        <p role="alert" className="text-body-sm text-danger">문자 템플릿을 불러올 수 없습니다: {error.message}</p>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="문자 포맷 관리"
      description={
        <>
          <span className="block">
            본문에 {"{{변수}}"} 형태로 플레이스홀더를 넣으면 발송 시 실제 값으로 치환됩니다. 변경사항은 저장 즉시 다음 발송부터 적용됩니다.
          </span>
          <span className="mt-1 block">
            단체 예약 안내 문구(견적 안내 · 7일 전 안내 등)는{" "}
            <Link href="/group-tools/messages" className="text-glow underline">
              단체 도구 › 안내 문자 템플릿
            </Link>
            에 있습니다.
          </span>
        </>
      }
    >
    {templates && templates.length > 0 ? (
      <TemplateList
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
      <div className="text-center py-8 text-muted">등록된 템플릿이 없습니다.</div>
    )}
    </AdminPage>
  );
}
