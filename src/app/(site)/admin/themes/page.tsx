import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
import type { Venue, ThemePriceTier, ThemeWithTiers, ThemeCategory } from "@/types/catalog";
import { ThemeEditor } from "./ThemeEditor";

export const dynamic = "force-dynamic";

export default async function AdminThemesPage() {
  const supabase = createAdminClient();

  const [themesRes, tiersRes, venuesRes, categoriesRes] = await Promise.all([
    supabase.from("themes").select("*").order("sort_order").order("created_at"),
    supabase.from("theme_price_tiers").select("*").order("min_headcount"),
    supabase.from("venues").select("*").order("created_at"),
    supabase.from("theme_categories").select("*").order("sort_order"),
  ]);

  const error = themesRes.error ?? tiersRes.error ?? venuesRes.error;
  if (error) {
    return (
      <AdminPage title="테마">
        <p role="alert" className="text-body-sm text-danger">
          테마를 불러올 수 없습니다: {error.message}
        </p>
      </AdminPage>
    );
  }

  const tiers = (tiersRes.data ?? []) as ThemePriceTier[];
  const themes: ThemeWithTiers[] = (themesRes.data ?? []).map((t) => ({
    ...(t as ThemeWithTiers),
    tiers: tiers.filter((x) => x.theme_id === t.id),
  }));

  return (
    <AdminPage
      title="테마"
      description={
        <>
          판매하는 방탈출 컨텐츠입니다. 가격·정원·소요시간·장소를 여기서 정하면 <strong>회차가 물려받습니다.</strong> 회차를 열 때는 날짜만 고르면 됩니다.
        </>
      }
    >
      <ThemeEditor themes={themes} venues={(venuesRes.data ?? []) as Venue[]} categories={(categoriesRes.data ?? []) as ThemeCategory[]} />
    </AdminPage>
  );
}
