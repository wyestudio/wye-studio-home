"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { generateUniqueCodes } from "@/lib/couponCode";

/**
 * 쿠폰 캠페인·코드 관리.
 *
 * 캠페인 = 쿠폰 종류(할인 조건). 코드 = 개별 장.
 * 조건을 코드마다 복사해두면 나중에 조건을 못 고치므로 2단으로 나눈다.
 */

export type CampaignInput = {
  id?: string;
  name: string;
  description: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  /** 정률 전용 상한. 없으면 대인원 신청에서 할인액이 튄다. */
  maxDiscountKrw: number | null;
  minHeadcount: number | null;
  themeId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  restrictToIssuedPhone: boolean;
  isActive: boolean;
};

function validate(input: CampaignInput): string | null {
  if (!input.name.trim()) return "쿠폰 이름을 입력해주세요.";
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0)
    return "할인 값을 입력해주세요.";
  if (input.discountType === "percent" && (input.discountValue < 1 || input.discountValue > 100))
    return "정률 할인은 1~100 사이여야 합니다.";
  if (input.validFrom && input.validUntil && input.validFrom >= input.validUntil)
    return "사용 종료일이 시작일보다 빨라요.";
  return null;
}

export async function saveCampaign(input: CampaignInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();
    const row = {
      name: input.name.trim(),
      description: input.description.trim() || null,
      discount_type: input.discountType,
      discount_value: Math.round(input.discountValue),
      // 정액 쿠폰에 상한은 의미가 없다. 남겨두면 나중에 혼란만 준다.
      max_discount_krw: input.discountType === "percent" ? input.maxDiscountKrw : null,
      min_headcount: input.minHeadcount,
      theme_id: input.themeId,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      restrict_to_issued_phone: input.restrictToIssuedPhone,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    };

    const { error } = input.id
      ? await supabase.from("coupon_campaigns").update(row).eq("id", input.id)
      : await supabase.from("coupon_campaigns").insert(row);
    if (error) throw error;

    await writeAuditLog({
      action: "coupon.campaign_saved",
      targetType: "coupon_campaign",
      targetId: input.id ?? "(신규)",
      summary: `쿠폰 종류 저장 — ${input.name}`,
    });

    revalidatePath("/admin/coupons");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "쿠폰 저장 실패");
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    // 이미 쓰인 쿠폰이 있으면 지우지 않는다. 신청 기록에서 할인 근거가 사라진다.
    const { count } = await supabase
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .not("used_at", "is", null);

    if ((count ?? 0) > 0) {
      return { error: `이미 사용된 쿠폰이 ${count}장 있어 삭제할 수 없습니다. 대신 '중지'로 바꿔주세요.` };
    }

    const { error } = await supabase.from("coupon_campaigns").delete().eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "coupon.campaign_deleted",
      targetType: "coupon_campaign",
      targetId: id,
      summary: "쿠폰 종류 삭제",
    });

    revalidatePath("/admin/coupons");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "쿠폰 삭제 실패");
  }
}

export type IssueResult = { success: true; codes: string[] } | { error: string };

/**
 * 코드 일괄 발급.
 *
 * 발급 대상(누구에게 줬는지)은 여기서 지정하지 않는다. 로그인이 없어 전화번호로
 * 식별해야 하는데, 그건 발송 단계에서 참가자 명단과 함께 붙이는 게 맞다.
 */
export async function issueCoupons(input: {
  campaignId: string;
  count: number;
  prefix: string;
  label: string;
}): Promise<IssueResult> {
  try {
    if (input.count < 1 || input.count > 500) return { error: "1~500장 사이로 발급해주세요." };

    const supabase = await requireAdmin();
    const codes = generateUniqueCodes(input.count, input.prefix.trim());

    if (codes.length < input.count) {
      return { error: "코드를 만들지 못했어요. 다시 시도해주세요." };
    }

    const { error } = await supabase.from("coupons").insert(
      codes.map((code) => ({
        campaign_id: input.campaignId,
        code,
        issued_label: input.label.trim() || null,
      }))
    );
    // 유니크 충돌은 DB 가 최종 판정한다. 여기서 걸리면 그냥 다시 누르면 된다.
    if (error) throw error;

    await writeAuditLog({
      action: "coupon.issued",
      targetType: "coupon_campaign",
      targetId: input.campaignId,
      summary: `쿠폰 ${codes.length}장 발행`,
    });

    revalidatePath("/admin/coupons");
    return { success: true as const, codes };
  } catch (err) {
    const message = err instanceof Error ? err.message : "쿠폰 발급 실패";
    return { error: message };
  }
}

export async function deleteUnusedCoupon(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("coupons").delete().eq("id", id).is("used_at", null);
    if (error) throw error;
    await writeAuditLog({
      action: "coupon.deleted",
      targetType: "coupon",
      targetId: id,
      summary: "미사용 쿠폰 삭제",
    });

    revalidatePath("/admin/coupons");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "쿠폰 삭제 실패");
  }
}
