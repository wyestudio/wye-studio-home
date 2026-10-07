import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
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
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/popups" />

        <header className="mb-6">
          <h1 className="text-h2 font-semibold">접속 팝업</h1>
          <p className="mt-1 text-body-sm text-muted">
            홈 · 테마 목록 · 테마 상세에 들어왔을 때 뜨는 안내 팝업입니다.{" "}
            <strong>게시를 켜면 고객 화면에 바로 뜹니다.</strong> 신청 폼·참여내역 조회처럼
            작업 중인 화면에는 띄우지 않습니다.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">팝업을 불러올 수 없습니다: {error.message}</div>
        ) : (
          <PopupEditor popups={(data ?? []) as PopupRow[]} />
        )}
      </div>
    </div>
  );
}
