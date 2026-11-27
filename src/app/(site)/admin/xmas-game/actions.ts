"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";

/**
 * 크리스마스 게임 — 선물 코드 수령 처리 · 랭킹 숨김.
 *
 * ⚠️ 수령 처리는 **아직 안 받은 코드에만** 찍힌다(gift_redeemed_at is null 조건). 같은 코드를 두 사람이
 *    보여 줘도 두 번째는 "이미 수령" 으로 막힌다 — 현장에서 화면의 목록이 낡았더라도 서버가 거른다.
 * ⚠️ 닉네임은 손님이 지은 이름이다. 부적절하면 지우지 않고 숨긴다 — 그 사람의 판 전부를 같이 숨겨야
 *    다른 판의 기록으로 다시 올라오지 않는다.
 */

/** 손으로 친 코드를 저장된 모양으로. 줄표 · 띄어쓰기 · 소문자를 가리지 않는다. */
const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** 손님 화면과 같은 모양(ABC-DEF). */
const showCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

export async function redeemGift(rawCode: string): Promise<ActionResult> {
  try {
    const code = normalizeCode(rawCode);
    if (code.length !== 6) return { error: "코드는 6자리입니다." };
    const supabase = await requireAdmin();

    const { data, error } = await supabase
      .from("xmas_game_runs")
      .update({ gift_redeemed_at: new Date().toISOString() })
      .eq("gift_code", code)
      .is("gift_redeemed_at", null)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      const { data: found, error: findError } = await supabase
        .from("xmas_game_runs")
        .select("gift_redeemed_at")
        .eq("gift_code", code)
        .maybeSingle();
      if (findError) throw findError;
      return { error: found ? "이미 수령 처리된 코드입니다." : "없는 코드입니다." };
    }

    await writeAuditLog({
      action: "xmas_game.gift_redeemed",
      targetType: "xmas_game",
      targetId: data[0].id as string,
      summary: `크리스마스 선물 지급 (${showCode(code)})`,
      detail: { code },
    });
    revalidatePath("/admin/xmas-game");
    return { success: true, message: `${showCode(code)} 수령 처리했습니다.` };
  } catch (err) {
    return toActionError(err, "수령 처리 실패");
  }
}

/** 잘못 누른 수령 처리를 되돌린다. */
export async function restoreGift(rawCode: string): Promise<ActionResult> {
  try {
    const code = normalizeCode(rawCode);
    const supabase = await requireAdmin();
    const { data, error } = await supabase
      .from("xmas_game_runs")
      .update({ gift_redeemed_at: null })
      .eq("gift_code", code)
      .not("gift_redeemed_at", "is", null)
      .select("id");
    if (error) throw error;
    if (!data?.length) return { error: "수령 처리된 코드가 아닙니다." };

    await writeAuditLog({
      action: "xmas_game.gift_restored",
      targetType: "xmas_game",
      targetId: data[0].id as string,
      summary: `크리스마스 선물 지급 취소 (${showCode(code)})`,
      detail: { code },
    });
    revalidatePath("/admin/xmas-game");
    return { success: true, message: `${showCode(code)} 수령 처리를 되돌렸습니다.` };
  } catch (err) {
    return toActionError(err, "되돌리기 실패");
  }
}

/** 랭킹에서 숨기거나 다시 보인다. 그 사람(브라우저)의 판 전부에 적용한다. */
export async function setPlayerHidden(playerId: string, hidden: boolean): Promise<ActionResult> {
  try {
    if (!/^[0-9a-f-]{36}$/.test(playerId)) return { error: "대상을 찾을 수 없습니다." };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("xmas_game_runs").update({ hidden }).eq("player_id", playerId);
    if (error) throw error;

    await writeAuditLog({
      action: "xmas_game.hidden",
      targetType: "xmas_game",
      targetId: playerId,
      summary: hidden ? "크리스마스 게임 랭킹 숨김" : "크리스마스 게임 랭킹 숨김 해제",
      detail: { hidden },
    });
    revalidatePath("/admin/xmas-game");
    return { success: true, message: hidden ? "랭킹에서 숨겼습니다." : "다시 랭킹에 보입니다." };
  } catch (err) {
    return toActionError(err, "숨김 처리 실패");
  }
}
