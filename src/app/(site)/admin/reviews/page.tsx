import { AdminNav } from "@/components/admin/AdminNav";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSurveyQuotes } from "@/lib/reviewRating";
import { CandidateCard, type CandidateView } from "./CandidateCard";
import { UrlPasteBox } from "./UrlPasteBox";
import { SurveyQuoteList } from "./SurveyQuoteList";

export const dynamic = "force-dynamic";

/**
 * 후기 후보 관리.
 *
 * 크론(`/api/cron/collect-reviews`)이 네이버에서 찾아와 쌓고, 여기서 사람이 고른다.
 * 고른 것만 테마의 후기 블록으로 간다 — 검색 결과에는 우리와 무관한 글이 반드시
 * 섞이므로 자동으로 싣지 않는다.
 *
 * 아래쪽 '설문 한줄 후기' 는 표에 쌓지 않고 설문 시트를 그때그때 읽는다
 * (`fetchSurveyQuotes`). 고르면 후기 블록의 quotes 에 바로 들어간다.
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

  const [{ data: cands, error }, { data: themeRows }, survey] = await Promise.all([
    supabase
      .from("review_candidates")
      .select("*")
      .order("discovered_at", { ascending: false })
      .limit(300),
    supabase.from("themes").select("slug, name, content").order("slug"),
    fetchSurveyQuotes(),
  ]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">후기 후보를 불러올 수 없습니다: {error.message}</p>
      </div>
    );
  }

  const rows = (cands as CandidateView[]) ?? [];
  const themeList =
    (themeRows as { slug: string; name: string; content: { blocks?: unknown[] } | null }[]) ?? [];
  const themes = themeList.map((t) => ({ slug: t.slug, name: t.name }));
  // 테마별로 지금 실려 있는 한줄 후기 글. 설문 답이 실렸는지 이걸로 가린다.
  const quoteThemes = themeList.map((t) => {
    const block = (t.content?.blocks ?? []).find(
      (b) => (b as { type?: string })?.type === "reviews"
    ) as { quotes?: { text?: string }[] } | undefined;
    return {
      slug: t.slug,
      name: t.name,
      quoteTexts: (block?.quotes ?? []).map((q) => q?.text ?? "").filter(Boolean),
    };
  });
  const byStatus = (s: string) => rows.filter((r) => r.status === s);
  const newCount = byStatus("new").length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/reviews" />

        <h1 className="mb-2 text-h2 font-semibold">후기 관리</h1>
        <p className="mb-6 flex gap-4 text-body-sm">
          <a href="#links" className="text-glow hover:underline">
            블로그·인스타 후기
          </a>
          <a href="#survey" className="text-glow hover:underline">
            설문 한줄 후기
          </a>
        </p>

        <h2 id="links" className="mb-2 scroll-mt-32 text-h3 font-semibold">
          블로그·인스타 후기
        </h2>
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

        <h2 id="survey" className="mb-2 mt-12 scroll-mt-32 text-h3 font-semibold">
          설문 한줄 후기
        </h2>
        <p className="mb-4 text-body-sm text-muted">
          설문 서술형 답에서 골라 테마 상세의 한줄 후기에 넣고 뺍니다. 새 응답은 자동으로 이
          목록에 나타납니다. 5개 이상이면 상세 화면에서 자동으로 넘어가는 슬라이드가 됩니다.
        </p>
        {survey.ok ? (
          <SurveyQuoteList quotes={survey.quotes} themes={quoteThemes} />
        ) : (
          <p className="text-body-sm text-danger">설문을 읽지 못했습니다: {survey.error}</p>
        )}
      </div>
    </div>
  );
}
