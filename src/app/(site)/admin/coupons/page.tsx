import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { CouponPanel } from "./CouponPanel";
import type { CampaignRow } from "./CampaignEditor";
import type { CouponRow } from "./CouponPanel";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const supabase = createAdminClient();

  const [campaignsRes, couponsRes, themesRes] = await Promise.all([
    supabase.from("coupon_campaigns").select("*").order("created_at", { ascending: false }),
    supabase
      .from("coupons")
      .select("id, campaign_id, code, issued_label, used_at")
      .order("code"),
    supabase.from("themes").select("id, name").order("sort_order"),
  ]);

  const error = campaignsRes.error ?? couponsRes.error;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <AdminNav current="/coupons" />

        <header className="mb-5">
          <h1 className="text-2xl font-bold">쿠폰</h1>
          <p className="mt-1 text-sm text-muted">
            쿠폰 종류를 만들고 코드를 찍어냅니다. 코드 1장은 한 번만 쓸 수 있고, 신청 1건에 1장만
            적용됩니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">불러올 수 없습니다: {error.message}</div>
        ) : (
          <CouponPanel
            campaigns={(campaignsRes.data ?? []) as CampaignRow[]}
            coupons={(couponsRes.data ?? []) as CouponRow[]}
            themes={(themesRes.data ?? []) as { id: string; name: string }[]}
          />
        )}
      </div>
    </div>
  );
}
