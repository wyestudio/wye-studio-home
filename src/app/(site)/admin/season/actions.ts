"use server";

import { updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { SITE_SEASON_TAG } from "@/lib/siteSeason";
import { isSiteSkin, SITE_SKIN_LABELS, type SiteSkin } from "@/lib/season";

/**
 * 시즌 스킨 켜기/끄기.
 *
 * ⚠️ 켜는 순간 **고객 화면 전체에 바로 씌워진다**(캐시 30초 안). 그래서 화면에서
 *    한 번 더 확인한다. 끝나는 날짜는 두지 않는다 — 운영자가 직접 끈다.
 * ⚠️ 값은 site_settings 'site.season' 한 줄이다. 끌 때도 줄을 지우지 않고 skin 을
 *    null 로 둔다 — 언제 켜고 껐는지는 감사로그에 남는다.
 */
export async function setSiteSkin(skin: SiteSkin | null): Promise<ActionResult> {
  try {
    if (skin !== null && !isSiteSkin(skin)) return { error: "알 수 없는 스킨입니다." };

    const supabase = await requireAdmin();
    const { error } = await supabase.from("site_settings").upsert(
      {
        key: "site.season",
        value: { skin },
        description: "고객 화면에 씌울 시즌 스킨(halloween 등). null 이면 기본 화면. 어드민 > 시즌 스킨에서 바꾼다.",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw error;

    await writeAuditLog({
      action: "site_setting.saved",
      targetType: "site_setting",
      targetId: "site.season",
      summary: skin ? `시즌 스킨 켬 (${SITE_SKIN_LABELS[skin]})` : "시즌 스킨 끔",
      detail: { skin },
    });

    updateTag(SITE_SEASON_TAG);
    return {
      success: true,
      message: skin ? `${SITE_SKIN_LABELS[skin]} 스킨을 켰습니다.` : "시즌 스킨을 껐습니다.",
    };
  } catch (err) {
    return toActionError(err, "시즌 스킨 저장 실패");
  }
}
