import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
import { fetchMarketingOptouts, fetchMarketingRecipients } from "@/lib/marketingSmsServer";
import { MarketingSmsTabs, type MarketingSmsTab, type SendHistoryRow } from "./MarketingSmsTabs";

export const dynamic = "force-dynamic";

/** 주소의 ?tab= 으로 처음 열 탭을 고른다(없거나 모르는 값이면 작성). */
const TAB_KEYS: MarketingSmsTab[] = ["compose", "history", "optout"];

/** 발송 기록에 보여 줄 건수 — 최근 것만. 그보다 오래된 것은 감사로그에서 본다. */
const HISTORY_LIMIT = 50;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * 광고 문자 — 작성 / 발송 기록 / 수신거부 탭(관리자 개편 docs/01 5장, 2026-11-27 대표님).
 * 발송 기록은 새 표를 만들지 않고, 발송할 때마다 남기던 감사로그(marketing_sms.sent)를 읽는다.
 */
export default async function MarketingSmsPage({ searchParams }: PageProps<"/admin/marketing-sms">) {
  const sp = await searchParams;
  const initialTab: MarketingSmsTab = TAB_KEYS.some((t) => t === sp.tab) ? (sp.tab as MarketingSmsTab) : "compose";

  const supabase = createAdminClient();

  const [recipientsRes, optoutsRes, historyRes] = await Promise.allSettled([
    fetchMarketingRecipients(supabase),
    fetchMarketingOptouts(supabase),
    supabase
      .from("audit_logs")
      .select("id, created_at, detail")
      .eq("action", "marketing_sms.sent")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  const failed = [recipientsRes, optoutsRes].find((r) => r.status === "rejected");
  const loadError = failed
    ? ((failed.reason as { message?: string })?.message ?? "불러올 수 없습니다.")
    : null;
  const recipients = recipientsRes.status === "fulfilled" ? recipientsRes.value : [];
  const optouts = optoutsRes.status === "fulfilled" ? optoutsRes.value : [];

  // 기록을 못 읽어도 작성 · 수신거부는 그대로 쓴다 — 기록 탭에만 알린다.
  const historyError =
    historyRes.status === "rejected"
      ? ((historyRes.reason as { message?: string })?.message ?? "불러올 수 없습니다.")
      : (historyRes.value.error?.message ?? null);
  // ⚠️ 화면에는 문구와 건수만 내린다. 감사로그의 전화번호 해시 · IP 는 넘기지 않는다.
  const history: SendHistoryRow[] =
    historyRes.status === "fulfilled"
      ? ((historyRes.value.data ?? []) as { id: number; created_at: string; detail: Record<string, unknown> | null }[]).map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          body: typeof r.detail?.body === "string" ? r.detail.body : "",
          requested: num(r.detail?.requested),
          dropped: num(r.detail?.dropped_not_eligible),
          succeeded: num(r.detail?.succeeded),
        }))
      : [];

  return (
    <AdminPage
      title="광고 문자"
      description="이미 끝난 회차에 실제로 참여한 사람(확정·입금확인, 취소·환불 제외) 중 본인이 마케팅 수신에 동의했고 수신거부하지 않은 사람에게 보냅니다. 동행자는 본인 동의가 없어 빠집니다."
    >
      {loadError ? (
        <p role="alert" className="text-body-sm text-danger">불러올 수 없습니다: {loadError}</p>
      ) : (
        <MarketingSmsTabs
          initialTab={initialTab}
          recipients={recipients}
          optouts={optouts}
          history={history}
          historyError={historyError}
          historyLimit={HISTORY_LIMIT}
        />
      )}
    </AdminPage>
  );
}
