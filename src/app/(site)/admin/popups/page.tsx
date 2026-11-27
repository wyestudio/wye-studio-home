import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
import { PopupEditor, type PopupRow } from "./PopupEditor";

export const dynamic = "force-dynamic";

export default async function AdminPopupsPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("popups")
    .select("*")
    .order("is_active", { ascending: false })
    .order("sort")
    .order("created_at", { ascending: false });

  return (
    <AdminPage
      title="접속 팝업"
      description={
        <>
          <span className="block">
            홈 · 테마 목록 · 테마 상세에 들어왔을 때 뜨는 안내 팝업입니다.{" "}
            <strong>게시를 켜면 고객 화면에 바로 뜹니다.</strong> 신청 폼·신청내역 조회처럼
            작업 중인 화면에는 띄우지 않습니다.
          </span>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-body-sm text-danger">팝업을 불러올 수 없습니다: {error.message}</p>
      ) : (
        <PopupEditor popups={(data ?? []) as PopupRow[]} />
      )}
    </AdminPage>
  );
}
