import { createAdminClient } from "@/lib/supabase/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  XmasGameAdmin,
  type GameFunnel,
  type GameOverview,
  type GiftRow,
} from "./XmasGameAdmin";

export const dynamic = "force-dynamic";

/**
 * 크리스마스 게임 「산타의 어드벤트 캘린더」 — 랭킹 · 사람별 플레이 기록 · 라운드 도달 · 선물 코드 지급 · 참여 단계.
 * 표와 함수는 supabase/migrations/20261126062217_xmas_game.sql, 사람별 판 목록은 20261127063948_xmas_game_admin_overview.sql.
 */
export default async function AdminXmasGamePage() {
  const supabase = createAdminClient();
  const [giftsRes, funnelRes, overviewRes] = await Promise.all([
    supabase
      .from("xmas_game_runs")
      .select(
        "id, gift_code, gift_issued_at, gift_redeemed_at, score5, nickname",
      )
      .not("gift_code", "is", null)
      .order("gift_issued_at", { ascending: false })
      .limit(2000),
    // 참여 단계 — 방문 발자취에서 사람 수로 센다. 실패하면 그 칸만 빠진다
    supabase.rpc("xmas_game_funnel"),
    // 사람마다 판 목록(랭킹에 등록 안 한 사람까지) — 랭킹 · 플레이 기록 · 라운드 도달을 여기서 만든다
    supabase.rpc("xmas_game_admin"),
  ]);
  const error = giftsRes.error ?? overviewRes.error;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <AdminNav current="/xmas-game" />

        <header className="mb-6">
          <h1 className="text-h2 font-semibold">크리스마스 게임</h1>
          <p className="mt-1 text-body-sm text-muted">
            테마 상세의 <strong>산타의 어드벤트 캘린더</strong> 게임입니다.
            손님이 보여 주는 <strong>선물 코드</strong>는 아래 「선물 코드」
            에서 확인하고 지급 처리하세요. 랭킹의 닉네임이 부적절하면{" "}
            <strong>숨김</strong>으로 두세요.
          </p>
        </header>

        {error ? (
          <div className="text-red-400">
            게임 기록을 불러올 수 없습니다: {error.message}
          </div>
        ) : (
          <XmasGameAdmin
            gifts={(giftsRes.data ?? []) as GiftRow[]}
            funnel={funnelRes.error ? null : (funnelRes.data as GameFunnel)}
            overview={overviewRes.data as GameOverview}
          />
        )}
      </div>
    </div>
  );
}
