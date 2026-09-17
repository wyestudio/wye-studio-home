"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { UTM_MEDIUMS, SHORT_LINKS_TAG } from "@/lib/utmLinks";

export type UtmLinkInput = {
  id?: string;
  label: string;
  slug: string;
  landing_path: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  note: string;
  sort: number;
  status: "active" | "disabled";
};

/** 소문자 스네이크 케이스(WYE-89 1.1). 빈 값은 여기서 판단하지 않는다. */
const SNAKE = /^[a-z0-9_]+$/;

function validate(input: UtmLinkInput): string | null {
  if (!input.label.trim()) return "이 링크를 어디에 거는지 이름을 적어주세요.";

  const path = input.landing_path.trim();
  if (!path.startsWith("/")) return "랜딩 경로는 / 로 시작해야 합니다. 예: /themes/baotalchul";
  if (path.includes("?")) return "랜딩 경로에 물음표를 넣지 마세요. UTM 은 아래 칸에 따로 적습니다.";

  for (const [name, value] of [
    ["utm_source", input.utm_source],
    ["utm_campaign", input.utm_campaign],
  ] as const) {
    const v = value.trim();
    if (!v) return `${name} 는 비울 수 없습니다.`;
    if (!SNAKE.test(v)) {
      return `${name} 는 소문자·숫자·밑줄만 쓸 수 있습니다(WYE-89 1.1). 입력값: ${v}`;
    }
  }

  if (!UTM_MEDIUMS.some((m) => m.value === input.utm_medium)) {
    return "utm_medium 은 목록에서 골라주세요. 규칙 밖 값을 쓰면 GA4 가 채널로 분류하지 못합니다.";
  }

  for (const [name, value] of [
    ["utm_content", input.utm_content],
    ["utm_term", input.utm_term],
  ] as const) {
    const v = value.trim();
    if (v && !SNAKE.test(v)) {
      return `${name} 는 소문자·숫자·밑줄만 쓸 수 있습니다. 입력값: ${v}`;
    }
  }

  const slug = input.slug.trim();
  if (slug) {
    if (slug.startsWith("/")) return "짧은 주소는 / 없이 적어주세요. 예: open-event";
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(slug)) {
      return "짧은 주소는 소문자·숫자·하이픈만 쓸 수 있습니다. 예: naver-cafe";
    }
    if (slug.includes("/")) {
      return "짧은 주소는 한 칸입니다. 슬래시를 넣을 수 없습니다.";
    }
  }

  return null;
}

export async function saveUtmLink(input: UtmLinkInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();

    // 코드에 박힌 링크(managed_by='code')는 기록일 뿐이라 값을 고쳐도 동작이
    // 안 바뀐다. 착각을 막으려고 메모와 상태만 고칠 수 있게 한다.
    if (input.id) {
      const { data: existing, error: readErr } = await supabase
        .from("utm_links")
        .select("managed_by")
        .eq("id", input.id)
        .single();
      if (readErr) throw readErr;

      if (existing?.managed_by === "code") {
        const { error } = await supabase
          .from("utm_links")
          .update({
            note: input.note.trim() || null,
            status: input.status,
            sort: input.sort,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.id);
        if (error) throw error;

        await writeAuditLog({
          action: "utm_link.saved",
          targetType: "utm_link",
          targetId: input.id,
          summary: `유입링크 메모·상태 변경(코드 고정) — ${input.label}`,
        });

        revalidatePath("/admin/utm");
        return { success: true as const, message: "코드에 박힌 링크라 메모와 상태만 저장했습니다." };
      }
    }

    const row = {
      label: input.label.trim(),
      slug: input.slug.trim() || null,
      landing_path: input.landing_path.trim(),
      utm_source: input.utm_source.trim(),
      utm_medium: input.utm_medium,
      utm_campaign: input.utm_campaign.trim(),
      utm_content: input.utm_content.trim() || null,
      utm_term: input.utm_term.trim() || null,
      note: input.note.trim() || null,
      sort: input.sort,
      status: input.status,
      updated_at: new Date().toISOString(),
    };

    let linkId = input.id ?? "";
    if (input.id) {
      const { error } = await supabase.from("utm_links").update(row).eq("id", input.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("utm_links")
        .insert({ ...row, managed_by: "db" })
        .select("id")
        .single();
      if (error) throw error;
      linkId = data.id as string;
    }

    await writeAuditLog({
      action: "utm_link.saved",
      targetType: "utm_link",
      targetId: linkId,
      summary: `유입링크 저장 — ${input.label} (${row.utm_source}/${row.utm_medium}/${row.utm_campaign})`,
    });

    revalidatePath("/admin/utm");
    // 짧은 주소 해석기가 목록을 캐시한다. 바로 눌러볼 수 있게 털어준다.
    updateTag(SHORT_LINKS_TAG);
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "유입링크 저장 실패");
  }
}

/**
 * 지우지 않고 내린다.
 *
 * 링크를 지우면 그 캠페인으로 들어온 과거 유입이 무슨 뜻이었는지 알 수 없게 된다.
 * 끝난 이벤트도 기록은 남겨야 나중에 GA4 숫자를 해석할 수 있다.
 */
export async function setUtmLinkStatus(
  id: string,
  status: "active" | "disabled"
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("utm_links")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "utm_link.status",
      targetType: "utm_link",
      targetId: id,
      summary: `유입링크 ${status === "active" ? "사용" : "중단"}`,
    });

    revalidatePath("/admin/utm");
    updateTag(SHORT_LINKS_TAG);
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "상태 변경 실패");
  }
}
