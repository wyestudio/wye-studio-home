"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { saveSnapshot } from "@/lib/settlement";
import { writeAuditLog } from "@/lib/auditLog";

export type SaveResult = { success: true } | { error: string };

/**
 * 정산 내역을 그 시점 그대로 보관한다.
 *
 * ⚠️ 보관은 **기록일 뿐**이다. 정산 계산은 이 기록을 보지 않는다 —
 *    보관했다고 그 달이 잠기거나 건이 제외되지 않는다.
 */
export async function saveSettlementSnapshot(
  month: string,
  note: string
): Promise<SaveResult> {
  try {
    await requireAdmin();
    await saveSnapshot(month, note);
    await writeAuditLog({
      action: "settlement.snapshot_saved",
      targetType: "settlement",
      targetId: month,
      summary: `${month} 정산 내역 보관`,
    });
    revalidatePath("/admin/settlement");
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "보관에 실패했습니다." };
  }
}
