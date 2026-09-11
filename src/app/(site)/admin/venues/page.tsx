import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import type { Venue } from "@/types/catalog";
import { VenueEditor } from "./VenueEditor";

export const dynamic = "force-dynamic";

export default async function AdminVenuesPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <AdminNav current="/venues" />

        <header className="mb-6">
          <h1 className="text-2xl font-bold">장소</h1>
          <p className="mt-1 text-sm text-muted">
            대관 장소를 관리합니다. <strong>정확 주소는 고객에게 노출되지 않고</strong> 전날안내 문자에만
            쓰입니다. 목록·상세 화면에는 &ldquo;공개용 위치&rdquo;만 보입니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">장소를 불러올 수 없습니다: {error.message}</div>
        ) : (
          <VenueEditor venues={(data ?? []) as Venue[]} />
        )}
      </div>
    </div>
  );
}
