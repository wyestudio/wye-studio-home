import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { CouponTabs } from "./CouponTabs";
import type { CampaignRow } from "./CampaignEditor";
import type { CouponRow } from "./CouponPanel";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const supabase = createAdminClient();

  const [campaignsRes, couponsRes, themesRes, sessionsRes, templatesRes] = await Promise.all([
    supabase.from("coupon_campaigns").select("*").order("created_at", { ascending: false }),
    supabase
      .from("coupons")
      .select("id, campaign_id, code, issued_label, used_at")
      .order("code"),
    supabase.from("themes").select("id, name").order("sort_order"),
    // 발송 대상은 "이 회차에 참여한 사람" 으로 고른다.
    supabase.from("session_display").select("id, theme_id, theme_name, format_label, start_at")
      .order("start_at", { ascending: false }),
    supabase.from("sms_templates").select("key, label").like("key", "coupon%").order("label"),
  ]);

  const error = campaignsRes.error ?? couponsRes.error;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
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
          <CouponTabs
            campaigns={(campaignsRes.data ?? []) as CampaignRow[]}
            coupons={(couponsRes.data ?? []) as CouponRow[]}
            themes={(themesRes.data ?? []) as { id: string; name: string }[]}
            sessions={(sessionsRes.data ?? []).map((s) => ({
              id: s.id as string,
              start_at: s.start_at as string,
              theme_id: (s.theme_id as string | null) ?? null,
              theme_name: (s.theme_name as string | null) ?? "(테마 없음)",
              note: (s.format_label as string | null) ?? null,
            }))}
            templates={(templatesRes.data ?? []) as { key: string; label: string }[]}
          />
        )}
      </div>
    </div>
  );
}
