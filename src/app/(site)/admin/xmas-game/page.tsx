import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { XmasGameAdmin, type GameStats, type GiftRow, type RankRow } from "./XmasGameAdmin";

export const dynamic = "force-dynamic";

/** 한 화면에 싣는 랭킹 인원. 숨길 것을 찾는 화면이라 위쪽만 보면 된다. */
const RANK_LIMIT = 100;

/**
 * 크리스마스 게임 「산타의 어드벤트 캘린더」 — 현장에서 선물 코드를 확인하고, 랭킹의 닉네임을 살핀다.
 * 표와 함수는 supabase/migrations/20261126062217_xmas_game.sql.
 */
export default async function AdminXmasGamePage() {
  const supabase = createAdminClient();
  const [startedRes, finishedRes, giftsRes, ranksRes, statsRes] = await Promise.all([
    supabase.from("xmas_game_runs").select("id", { count: "exact", head: true }),
    supabase.from("xmas_game_runs").select("id", { count: "exact", head: true }).gte("round", 5),
    supabase
      .from("xmas_game_runs")
      .select("id, gift_code, gift_issued_at, gift_redeemed_at, score5, nickname")
      .not("gift_code", "is", null)
      .order("gift_issued_at", { ascending: false })
      .limit(2000),
    // 사람마다 가장 좋은 판 하나만 남긴다(고객 화면의 xmas_game_board 와 같은 순서). 숨긴 것도 읽는다
    supabase
      .from("xmas_game_runs")
      .select("id, player_id, nickname, score, round, max_combo, finished_at, hidden")
      .not("nickname", "is", null)
      .gte("round", 5)
      .order("score", { ascending: false })
      .order("max_combo", { ascending: false })
      .order("finished_at")
      .limit(1000),
    // 난이도 확인 — 사람 기준 집계는 줄 수가 많아 DB 가 센다. 실패해도 나머지 화면은 그대로 보여 준다(칸만 빠진다)
    supabase.rpc("xmas_game_stats"),
  ]);
  const error = startedRes.error ?? finishedRes.error ?? giftsRes.error ?? ranksRes.error;

  const seen = new Set<string>();
  const ranks: RankRow[] = [];
  for (const row of (ranksRes.data ?? []) as RankRow[]) {
    if (seen.has(row.player_id)) continue;
    seen.add(row.player_id);
    if (ranks.length < RANK_LIMIT) ranks.push(row);
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/xmas-game" />

        <header className="mb-6">
          <h1 className="text-h2 font-semibold">크리스마스 게임</h1>
          <p className="mt-1 text-body-sm text-muted">
            테마 상세의 <strong>산타의 어드벤트 캘린더</strong> 게임입니다. 크리스마스 스킨을 켜면 고객 화면에
            나타납니다. 손님이 보여 주는 <strong>선물 코드</strong>를 여기서 확인하고 수령 처리하세요 — 한 번
            처리한 코드는 다시 쓸 수 없습니다. 랭킹의 닉네임은 손님이 지은 이름이라, 부적절하면{" "}
            <strong>숨김</strong>으로 두세요.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">게임 기록을 불러올 수 없습니다: {error.message}</div>
        ) : (
          <XmasGameAdmin
            started={startedRes.count ?? 0}
            finished={finishedRes.count ?? 0}
            gifts={(giftsRes.data ?? []) as GiftRow[]}
            ranks={ranks}
            stats={statsRes.error ? null : (statsRes.data as GameStats)}
          />
        )}
      </div>
    </div>
  );
}
