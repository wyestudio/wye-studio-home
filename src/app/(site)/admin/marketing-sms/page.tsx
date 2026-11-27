import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
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
    <AdminPage
      title="광고 문자"
      description={
        <>
          <span className="block">
            이미 끝난 회차에 실제로 참여한 사람(확정·입금확인, 취소·환불 제외) 중 본인이 마케팅
            수신에 동의했고 수신거부하지 않은 사람에게 보냅니다. 동행자는 본인 동의가 없어 빠집니다.
          </span>
        </>
      }
    >
      {loadError ? (
        <p role="alert" className="text-body-sm text-danger">불러올 수 없습니다: {loadError}</p>
      ) : (
        <div className="space-y-8">
          <MarketingSmsPanel recipients={recipients} />
          <OptoutPanel optouts={optouts} />
        </div>
      )}
    </AdminPage>
  );
}
