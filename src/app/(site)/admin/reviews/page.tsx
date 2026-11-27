import { AdminEmpty, AdminPage, AdminTabs } from "@/components/admin/ui";
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
 * '설문 한줄 후기' 는 표에 쌓지 않고 설문 시트를 그때그때 읽는다
 * (`fetchSurveyQuotes`). 고르면 후기 블록의 quotes 에 바로 들어간다.
 *
 * 탭(2026-11-27 대표님 — 관리자 개편): 볼 것 / 실은 것 / 관련없음 / 설문 한줄 후기.
 * 예전에는 한 화면에 전부 쌓아 두었다(12화면 길이). 「볼 것」 이 0건이면 할 일이 없다는 뜻이고,
 * 나머지 탭은 기록이다 — 잘못 누른 것은 그 탭에서 되돌린다.
 */
const CANDIDATE_TABS = ["new", "published", "ignored"] as const;
type CandidateTab = (typeof CANDIDATE_TABS)[number];
type TabKey = CandidateTab | "survey";

const TAB_LABEL: Record<TabKey, string> = {
  new: "볼 것",
  published: "실은 것",
  ignored: "관련없음",
  survey: "설문 한줄 후기",
};
const TAB_KEYS: TabKey[] = [...CANDIDATE_TABS, "survey"];

const EMPTY: Record<CandidateTab, { title: string; hint: string }> = {
  new: { title: "볼 후기가 없어요", hint: "새로 찾아온 글이 없습니다. 인스타 글은 「주소로 직접 담기」 로 넣습니다." },
  published: { title: "아직 실은 후기가 없어요", hint: "「볼 것」 탭에서 「후기 등록」 을 누르면 여기로 옵니다." },
  ignored: { title: "관련없음으로 치운 글이 없어요", hint: "「볼 것」 탭에서 「관련없음」 을 누르면 여기로 옵니다." },
};

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const sp = await searchParams;
  const tab: TabKey = TAB_KEYS.some((t) => t === sp.tab) ? (sp.tab as TabKey) : "new";

  const supabase = createAdminClient();

  const [{ data: cands, error }, { data: themeRows }, survey] = await Promise.all([
    supabase
      .from("review_candidates")
      .select("*")
      .order("discovered_at", { ascending: false })
      .limit(300),
    supabase.from("themes").select("slug, name, content").order("slug"),
    // 설문 시트는 그 탭을 열 때만 읽는다 — 다른 탭에서는 쓰지 않는다.
    tab === "survey" ? fetchSurveyQuotes() : Promise.resolve(null),
  ]);

  if (error) {
    return (
      <AdminPage title="후기 관리">
        <p role="alert" className="text-body-sm text-danger">
          후기 후보를 불러올 수 없습니다: {error.message}
        </p>
      </AdminPage>
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

  const tabs = TAB_KEYS.map((key) => ({
    key,
    label: TAB_LABEL[key],
    href: key === "new" ? "/reviews" : `/reviews?tab=${key}`,
    count: key === "survey" ? undefined : byStatus(key).length,
  }));

  return (
    <AdminPage
      title="후기 관리"
      description="블로그 · 인스타 후기와 설문 한줄 후기를 골라 테마 상세의 후기 블록에 싣습니다. 고른 것만 고객 화면에 나갑니다."
    >
      <AdminTabs tabs={tabs} current={tab} />

      {tab === "survey" ? (
        <>
          <p className="mb-4 text-body-sm text-muted">
            설문 서술형 답에서 골라 테마 상세의 한줄 후기에 넣고 뺍니다. 새 응답은 자동으로 이
            목록에 나타납니다. 5개 이상이면 상세 화면에서 자동으로 넘어가는 슬라이드가 됩니다.
          </p>
          {survey?.ok ? (
            <SurveyQuoteList quotes={survey.quotes} themes={quoteThemes} />
          ) : (
            <p role="alert" className="text-body-sm text-danger">
              설문을 읽지 못했습니다: {survey?.error}
            </p>
          )}
        </>
      ) : (
        <CandidateList tab={tab} list={byStatus(tab)} themes={themes} hasAny={rows.length > 0} />
      )}
    </AdminPage>
  );
}

function CandidateList({
  tab,
  list,
  themes,
  hasAny,
}: {
  tab: CandidateTab;
  list: CandidateView[];
  themes: { slug: string; name: string }[];
  /** 후보가 한 건이라도 담겨 있는가 — 하나도 없으면 주소 담는 칸을 펼쳐 둔다. */
  hasAny: boolean;
}) {
  return (
    <>
      {tab === "new" && (
        <>
          <p className="mb-3 text-body-sm text-muted">
            네이버는 하루 한 번 자동으로 찾아옵니다. 관련없음으로 치운 글은 다시 뜨지 않습니다. 잘못
            눌렀으면 「실은 것」 · 「관련없음」 탭에서 되돌립니다.
          </p>
          <UrlPasteBox defaultOpen={!hasAny} />
        </>
      )}

      {list.length === 0 ? (
        <AdminEmpty title={EMPTY[tab].title} hint={EMPTY[tab].hint} />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((c) => (
            <CandidateCard key={c.id} c={c} themes={themes} />
          ))}
        </div>
      )}
    </>
  );
}
