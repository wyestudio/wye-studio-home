import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
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
    <AdminPage
      title="장소"
      description={
        <>
          대관 장소를 관리합니다. <strong>상호명·주소·지도 링크는 테마 상세 &lsquo;진행 장소&rsquo; 블록에 공개됩니다</strong>(네이버 플레이스 등록용). 주소는
          장소안내 문자에도 쓰입니다.
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          장소를 불러올 수 없습니다: {error.message}
        </p>
      ) : (
        <VenueEditor venues={(data ?? []) as Venue[]} />
      )}
    </AdminPage>
  );
}
