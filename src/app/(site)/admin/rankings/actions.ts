"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { RANKINGS_TAG } from "@/lib/themes";
import { RANKING_GRADES, type RankingGrade } from "@/types/catalog";

/**
 * 랭킹 기록 저장·삭제.
 *
 * ⚠️ 저장하면 **테마 상세에 바로 나간다**(캐시 태그를 털어낸다). 팀명은 손님이 지은
 *    이름이라 부적절하면 지우기보다 '숨김' 으로 둔다 — 현장 연동이 같은 기록을 다시
 *    보내도 숨김은 유지된다(external_ref 로 같은 줄을 찾는다).
 */
export type RankingInput = {
  id?: string;
  theme_id: string;
  played_on: string;
  team_name: string;
  points: number;
  /** 'm:ss' 로 받은 남은 시간을 초로. 비우면 null. */
  remaining_sec: number | null;
  grade: RankingGrade;
  group_size: number | null;
  hint_free: boolean;
  hidden: boolean;
};

function validate(i: RankingInput): string | null {
  if (!i.theme_id) return "테마를 선택해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.played_on)) return "날짜를 입력해주세요.";
  const name = i.team_name.trim();
  if (!name) return "팀명을 입력해주세요.";
  if (name.length > 30) return "팀명은 30자까지입니다.";
  if (!Number.isInteger(i.points)) return "포인트는 정수로 입력해주세요.";
  if (i.remaining_sec !== null && (!Number.isInteger(i.remaining_sec) || i.remaining_sec < 0))
    return "남은 시간을 확인해주세요.";
  if (!RANKING_GRADES.includes(i.grade)) return "등급을 선택해주세요.";
  if (i.group_size !== null && ![2, 3, 4].includes(i.group_size)) return "인원 구분을 확인해주세요.";
  return null;
}

export async function saveRanking(input: RankingInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };
    const supabase = await requireAdmin();

    const row = {
      theme_id: input.theme_id,
      played_on: input.played_on,
      team_name: input.team_name.trim(),
      points: input.points,
      remaining_sec: input.remaining_sec,
      grade: input.grade,
      group_size: input.group_size,
      hint_free: input.hint_free,
      hidden: input.hidden,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = input.id
      ? await supabase.from("theme_rankings").update(row).eq("id", input.id).select("id").single()
      : await supabase.from("theme_rankings").insert(row).select("id").single();
    if (error) throw error;

    await writeAuditLog({
      action: "ranking.saved",
      targetType: "ranking",
      targetId: data.id as string,
      summary: `랭킹 기록 ${input.id ? "수정" : "추가"} — ${input.played_on} ${input.points}pt${input.hidden ? " (숨김)" : ""}`,
      detail: { ...row },
    });

    updateTag(RANKINGS_TAG);
    revalidatePath("/admin/rankings");
    return { success: true as const, message: "저장했습니다." };
  } catch (err) {
    return toActionError(err, "랭킹 저장 실패");
  }
}

export async function deleteRanking(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("theme_rankings").delete().eq("id", id);
    if (error) throw error;
    await writeAuditLog({ action: "ranking.deleted", targetType: "ranking", targetId: id, summary: "랭킹 기록 삭제" });
    updateTag(RANKINGS_TAG);
    revalidatePath("/admin/rankings");
    return { success: true as const, message: "삭제했습니다." };
  } catch (err) {
    return toActionError(err, "랭킹 삭제 실패");
  }
}
