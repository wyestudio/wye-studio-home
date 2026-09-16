import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_BUBBLE_KEY } from "@/lib/siteSettings";
import { AdminNav } from "@/components/admin/AdminNav";
import { ContentManager } from "./ContentManager";
import type { NoticeRow } from "./NoticeEditor";
import type { FaqRow } from "./FaqEditor";

export const dynamic = "force-dynamic";

/**
 * 공지·FAQ 관리.
 *
 * 어드민은 service_role 로 읽는다. 공개 화면과 달리 미게시 공지와
 * 비공개 FAQ 까지 봐야 하기 때문이다(RLS 는 anon 에만 걸린다).
 */
export default async function AdminContentPage() {
  const supabase = createAdminClient();

  const [noticesRes, faqsRes, bubbleRes] = await Promise.all([
    supabase
      .from("notices")
      .select("id, title, body, is_pinned, published_at, sort_order")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: true }),
    supabase
      .from("faqs")
      .select("id, question, answer, category, is_visible, sort_order")
      .order("sort_order", { ascending: true }),
    // 어드민은 service_role 로 읽는다 — 공개 정책(key like 'public.%')과 무관하게 전부 보인다.
    supabase.from("site_settings").select("value").eq("key", EVENT_BUBBLE_KEY).maybeSingle(),
  ]);

  const bubbleValue = (bubbleRes.data?.value ?? null) as { enabled?: boolean; text?: string } | null;
  const eventBubble = {
    enabled: bubbleValue?.enabled === true,
    text: typeof bubbleValue?.text === "string" ? bubbleValue.text : "",
  };

  const error = noticesRes.error ?? faqsRes.error;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/content" />

        <header className="mb-5">
          <h1 className="text-2xl font-bold">공지 · FAQ · 이벤트 말풍선</h1>
          <p className="mt-1 text-sm text-muted">
            여기서 고치면 배포 없이 바로 사이트에 반영됩니다. 고객에게는{" "}
            <a href="/notice" className="text-glow underline" target="_blank" rel="noopener noreferrer">
              Notice 페이지
            </a>
            에 보여요.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">불러올 수 없습니다: {error.message}</div>
        ) : (
          <ContentManager notices={(noticesRes.data ?? []) as NoticeRow[]} faqs={(faqsRes.data ?? []) as FaqRow[]} eventBubble={eventBubble} />
        )}
      </div>
    </div>
  );
}
