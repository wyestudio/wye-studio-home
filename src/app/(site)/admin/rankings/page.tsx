import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { RankingEditor, type RankingRow, type RankingTheme } from "./RankingEditor";

export const dynamic = "force-dynamic";

/** 'YYYY-MM' 이 아니면 이번 달(KST). */
function monthOf(v: unknown) {
  if (typeof v === "string" && /^\d{4}-\d{2}$/.test(v)) return v;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 7);
}

export default async function AdminRankingsPage({ searchParams }: PageProps<"/admin/rankings">) {
  const sp = await searchParams;
  const month = monthOf(sp.month);
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const supabase = createAdminClient();
  const [themesRes, rowsRes] = await Promise.all([
    supabase
      .from("themes")
      .select("id, name, variant_label")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("theme_rankings")
      .select("id, theme_id, played_on, team_name, points, remaining_sec, grade, group_size, hint_free, hidden, source")
      .gte("played_on", `${month}-01`)
      .lt("played_on", next)
      .order("played_on", { ascending: false })
      .order("points", { ascending: false }),
  ]);
  const error = themesRes.error ?? rowsRes.error;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/rankings" />

        <header className="mb-6">
          <h1 className="text-h2 font-semibold">랭킹</h1>
          <p className="mt-1 text-body-sm text-muted">
            테마 상세의 <strong>이달의 랭킹</strong> 블록에 나가는 기록입니다. 저장하면 고객 화면에
            바로 반영됩니다. 부적절한 팀명이나 리허설 기록은 지우지 말고 <strong>숨김</strong>으로
            두세요.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">랭킹을 불러올 수 없습니다: {error.message}</div>
        ) : (
          <RankingEditor
            month={month}
            themes={(themesRes.data ?? []) as RankingTheme[]}
            rows={(rowsRes.data ?? []) as RankingRow[]}
          />
        )}
      </div>
    </div>
  );
}
