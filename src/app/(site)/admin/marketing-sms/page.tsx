import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchMarketingOptouts, fetchMarketingRecipients } from "@/lib/marketingSmsServer";
import { MarketingSmsPanel } from "./MarketingSmsPanel";
import { OptoutPanel } from "./OptoutPanel";

export const dynamic = "force-dynamic";

export default async function MarketingSmsPage() {
  const supabase = createAdminClient();

  const [recipientsRes, optoutsRes] = await Promise.allSettled([
    fetchMarketingRecipients(supabase),
    fetchMarketingOptouts(supabase),
  ]);
  const failed = [recipientsRes, optoutsRes].find((r) => r.status === "rejected");
  const loadError = failed
    ? ((failed.reason as { message?: string })?.message ?? "불러올 수 없습니다.")
    : null;
  const recipients = recipientsRes.status === "fulfilled" ? recipientsRes.value : [];
  const optouts = optoutsRes.status === "fulfilled" ? optoutsRes.value : [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/marketing-sms" />

        <header className="mb-5">
          <h1 className="text-2xl font-bold">광고 문자</h1>
          <p className="mt-1 text-sm text-muted">
            이미 끝난 회차에 실제로 참여한 사람(확정·입금확인, 취소·환불 제외) 중 본인이 마케팅
            수신에 동의했고 수신거부하지 않은 사람에게 보냅니다. 동행자는 본인 동의가 없어 빠집니다.
          </p>
        </header>

        {loadError ? (
          <div className="text-red-400">불러올 수 없습니다: {loadError}</div>
        ) : (
          <div className="space-y-8">
            <MarketingSmsPanel recipients={recipients} />
            <OptoutPanel optouts={optouts} />
          </div>
        )}
      </div>
    </div>
  );
}
