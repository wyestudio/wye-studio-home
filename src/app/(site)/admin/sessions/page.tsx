import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPage } from "@/components/admin/ui";
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
      <AdminPage title="회차">
        <p role="alert" className="text-body-sm text-danger">
          편성을 불러올 수 없습니다: {error.message}
        </p>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="회차 편성"
      description={
        <>
          테마마다 <strong>언제 진행하고 언제 신청을 여는지</strong>를 정합니다. 회차는 이 규칙대로 자동으로 만들어지고, 정해진 시점이 되면 저절로 신청
          가능해집니다. 회차 하나하나는{" "}
          <Link href="/" className="text-glow underline">
            홈 달력
          </Link>
          에서 날짜별로 봅니다.
        </>
      }
    >
      <SessionManager themes={(themesRes.data ?? []) as Theme[]} schedules={(schedulesRes.data ?? []) as ThemeSchedule[]} />
    </AdminPage>
  );
}
