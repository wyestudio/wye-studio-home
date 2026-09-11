import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import type { Theme } from "@/types/catalog";
import { SessionManager, type ThemeSchedule } from "./SessionManager";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const supabase = createAdminClient();

  const [themesRes, schedulesRes] = await Promise.all([
    supabase.from("themes").select("*").order("sort_order").order("created_at"),
    supabase.from("theme_schedules").select("*"),
  ]);

  const error = themesRes.error ?? schedulesRes.error;
  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl">
          <AdminNav current="/sessions" />
          <div className="text-red-400">편성을 불러올 수 없습니다: {error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/sessions" />

        <header className="mb-6">
          <h1 className="text-2xl font-bold">회차 편성</h1>
          <p className="mt-1 text-sm text-muted">
            테마마다 <strong>언제 진행하고 언제 신청을 여는지</strong>를 정합니다. 회차는 이 규칙대로
            자동으로 만들어지고, 정해진 시점이 되면 저절로 신청 가능해집니다.
            회차 하나하나는 <strong>대시보드</strong>에서 날짜별로 봅니다.
          </p>
        </header>

        <SessionManager
          themes={(themesRes.data ?? []) as Theme[]}
          schedules={(schedulesRes.data ?? []) as ThemeSchedule[]}
        />
      </div>
    </div>
  );
}
