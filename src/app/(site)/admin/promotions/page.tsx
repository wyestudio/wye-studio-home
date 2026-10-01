import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { PromotionEditor, type PromotionRow, type ThemeOption } from "./PromotionEditor";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const supabase = createAdminClient();

  const [promoRes, tierRes, themeRes, baseTierRes] = await Promise.all([
    supabase
      .from("promotions")
      .select("*")
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("promotion_price_tiers").select("*").order("min_headcount"),
    supabase.from("themes").select("id, name").order("sort_order").order("created_at"),
    supabase.from("theme_price_tiers").select("theme_id, min_headcount, unit_price_krw"),
  ]);

  const error = promoRes.error ?? themeRes.error;

  const tiers = (tierRes.data ?? []) as {
    promotion_id: string;
    theme_id: string;
    min_headcount: number;
    unit_price_krw: number;
  }[];

  const promotions: PromotionRow[] = (promoRes.data ?? []).map((p) => ({
    ...(p as Omit<PromotionRow, "tiers">),
    tiers: tiers
      .filter((t) => t.promotion_id === (p as { id: string }).id)
      .map(({ theme_id, min_headcount, unit_price_krw }) => ({
        theme_id,
        min_headcount,
        unit_price_krw,
      })),
  }));

  const baseTiers = (baseTierRes.data ?? []) as {
    theme_id: string;
    min_headcount: number;
    unit_price_krw: number;
  }[];

  const themes: ThemeOption[] = (themeRes.data ?? []).map((t) => ({
    id: (t as { id: string }).id,
    name: (t as { name: string }).name,
    tiers: baseTiers
      .filter((b) => b.theme_id === (t as { id: string }).id)
      .map(({ min_headcount, unit_price_krw }) => ({ min_headcount, unit_price_krw })),
  }));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/promotions" />

        <header className="mb-6">
          <h1 className="text-2xl font-bold">프로모션</h1>
          <p className="mt-1 text-sm text-muted">
            기간 한정 할인(얼리버드)을 관리합니다.{" "}
            <strong>여기 금액이 그대로 고객 청구액이 됩니다</strong> — 켜는 즉시 조건에 맞는
            회차에 적용되고, 달력·회차 목록·가격표·신청 화면에 함께 표시됩니다.{" "}
            <strong>켤 수 있는 프로모션은 한 번에 하나</strong>입니다.
          </p>
          <p className="mt-1 text-sm text-muted">
            기본가(정가)는 여기가 아니라 <strong>테마 &gt; 요금 구간</strong>에 있습니다. 가격을
            두 곳에 적어두지 않으려고 분리했습니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">프로모션을 불러올 수 없습니다: {error.message}</div>
        ) : (
          <PromotionEditor promotions={promotions} themes={themes} />
        )}
      </div>
    </div>
  );
}
