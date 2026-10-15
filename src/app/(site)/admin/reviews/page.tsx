import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CandidateCard, type CandidateView } from "./CandidateCard";
import { UrlPasteBox } from "./UrlPasteBox";

export const dynamic = "force-dynamic";

/**
 * 후기 후보 관리.
 *
 * 크론(`/api/cron/collect-reviews`)이 네이버에서 찾아와 쌓고, 여기서 사람이 고른다.
 * 고른 것만 테마의 후기 블록으로 간다 — 검색 결과에는 우리와 무관한 글이 반드시
 * 섞이므로 자동으로 싣지 않는다.
 *
 * 탭이 아니라 한 화면에 세 묶음을 쌓아 둔다. "안 본 것" 이 0건이면 할 일이 없다는
 * 뜻이고, 그 아래는 기록이다.
 */
const STATUS_ORDER = ["new", "published", "ignored"] as const;
const STATUS_LABEL: Record<(typeof STATUS_ORDER)[number], string> = {
  new: "볼 것",
  published: "실은 것",
  ignored: "관련없음",
};

export default async function AdminReviewsPage() {
  const supabase = createAdminClient();

  const [{ data: cands, error }, { data: themeRows }] = await Promise.all([
    supabase
      .from("review_candidates")
      .select("*")
      .order("discovered_at", { ascending: false })
      .limit(300),
    supabase.from("themes").select("slug, name").order("slug"),
  ]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">후기 후보를 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }

  const rows = (cands as CandidateView[]) ?? [];
  const themes = (themeRows as { slug: string; name: string }[]) ?? [];
  const byStatus = (s: string) => rows.filter((r) => r.status === s);
  const newCount = byStatus("new").length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-4 inline-block text-glow hover:underline">
          ← 돌아가기
        </Link>

        <h1 className="mb-2 text-h2 font-semibold">후기 관리</h1>
        <p className="mb-8 text-body-sm text-muted">
          볼 것 {newCount}건 · 실은 것 {byStatus("published").length}건 · 관련없음{" "}
          {byStatus("ignored").length}건
          <br />
          <span className="text-micro">
            네이버는 하루 한 번 자동으로 찾아옵니다. 관련없음으로 치운 글은 다시 뜨지 않습니다.
          </span>
        </p>

        <UrlPasteBox />

        {rows.length === 0 ? (
          <p className="py-4 text-muted">
            아직 담긴 후보가 없습니다. 위에 주소를 붙여넣거나, 수집 크론이 돌면 쌓입니다.
          </p>
        ) : (
          STATUS_ORDER.map((status) => {
            const list = byStatus(status);
            if (list.length === 0) return null;
            return (
              <section key={status} className="mb-8">
                <h2 className="mb-3 text-body font-semibold">
                  {STATUS_LABEL[status]}{" "}
                  <span className="text-muted">{list.length}</span>
                </h2>
                <div className="flex flex-col gap-3">
                  {list.map((c) => (
                    <CandidateCard key={c.id} c={c} themes={themes} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
