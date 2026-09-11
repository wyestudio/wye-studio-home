import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import type { Theme, SessionView } from "@/types/catalog";
import { SessionManager } from "./SessionManager";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const supabase = createAdminClient();

  const [sessionsRes, themesRes, unlinkedRes] = await Promise.all([
    supabase.from("session_view").select("*").order("start_at", { ascending: false }),
    supabase.from("themes").select("*").order("sort_order"),
    // session_view 는 themes 와 INNER JOIN 이라 theme_id 가 없는 회차는 안 보인다.
    // Phase 2(데이터 이관) 전의 과거 회차가 여기 해당한다.
    supabase.from("sessions").select("id", { count: "exact", head: true }).is("theme_id", null),
  ]);

  const error = sessionsRes.error ?? themesRes.error;
  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <AdminNav current="/sessions" />
          <div className="text-red-400">회차를 불러올 수 없습니다: {error.message}</div>
        </div>
      </div>
    );
  }

  const unlinked = unlinkedRes.count ?? 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <AdminNav current="/sessions" />

        <header className="mb-6">
          <h1 className="text-2xl font-bold">회차</h1>
          <p className="mt-1 text-sm text-muted">
            테마에 날짜를 붙여 신청을 받는 단위입니다. 가격·정원·소요시간·장소는{" "}
            <strong>테마에서 자동으로 가져옵니다.</strong>
          </p>
        </header>

        {unlinked > 0 && (
          <div className="mb-6 rounded border border-amber-500/50 px-3 py-2 text-sm text-amber-400">
            테마에 연결되지 않은 과거 회차가 {unlinked}건 있습니다. 아래 목록에는 나오지 않으며,
            데이터 이관(Phase 2) 후에 표시됩니다. 기존{" "}
            <Link href="/" className="underline">대시보드</Link>에서는 계속 볼 수 있습니다.
          </div>
        )}

        <SessionManager
          sessions={(sessionsRes.data ?? []) as SessionView[]}
          themes={(themesRes.data ?? []) as Theme[]}
        />
      </div>
    </div>
  );
}
