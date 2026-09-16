"use server";

import { revalidatePath, updateTag } from "next/cache";
import { EVENT_BUBBLE_TAG } from "@/lib/siteSettings";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { generateUniqueCodes, isValidCouponPrefix, FORBIDDEN_PREFIXES } from "@/lib/couponCode";
import { parseCsv } from "@/lib/csv";

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
  discountType: "fixed" | "percent" | "per_head";
  discountValue: number;
  /** 정률 전용 상한. 없으면 대인원 신청에서 할인액이 튄다. */
  maxDiscountKrw: number | null;
  minHeadcount: number | null;
  themeId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  restrictToIssuedPhone: boolean;
  stackable: boolean;
  isActive: boolean;
  /** 사이트 우하단 인스타 버튼 위 말풍선으로 이 이벤트를 알린다. */
  showEventBubble: boolean;
  /** 말풍선 문구. 비우면 쿠폰 이름이 그대로 나간다. */
  eventBubbleText: string;
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
      // 상한은 인원·금액에 따라 할인액이 달라지는 방식에서만 의미가 있다.
      max_discount_krw: input.discountType === "fixed" ? null : input.maxDiscountKrw,
      min_headcount: input.minHeadcount,
      theme_id: input.themeId,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      restrict_to_issued_phone: input.restrictToIssuedPhone,
      stackable: input.stackable,
      is_active: input.isActive,
      show_event_bubble: input.showEventBubble,
      event_bubble_text: input.eventBubbleText.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = input.id
      ? await supabase.from("coupon_campaigns").update(row).eq("id", input.id)
      : await supabase.from("coupon_campaigns").insert(row);
    if (error) throw error;

    // ⚠️ 저장된 조건을 같이 남긴다. 제휴 쿠폰은 계약으로 금액이 정해져 있어서
    //    "언제 얼마로 바뀌었나" 를 나중에 되짚을 수 있어야 한다(잼핏 계약 제6조 7항).
    await writeAuditLog({
      action: "coupon.campaign_saved",
      targetType: "coupon_campaign",
      targetId: input.id ?? "(신규)",
      summary: `쿠폰 종류 저장 — ${input.name}`,
      detail: {
        discount_type: row.discount_type,
        discount_value: row.discount_value,
        max_discount_krw: row.max_discount_krw,
        min_headcount: row.min_headcount,
        theme_id: row.theme_id,
        valid_from: row.valid_from,
        valid_until: row.valid_until,
        is_active: row.is_active,
        stackable: row.stackable,
        show_event_bubble: row.show_event_bubble,
      },
    });

    // 고객 화면의 말풍선이 30초간 들고 있는 값이라, 켜고 끄면 바로 털어준다.
    updateTag(EVENT_BUBBLE_TAG);
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

export type HandleIssueResult =
  | { success: true; code: string; alreadyIssued: boolean }
  | { error: string };

/**
 * 인스타 아이디로 쿠폰 한 장을 배정한다. (ManyChat 자동화가 멈췄을 때 수동 발급용)
 *
 * ⚠️ 자동화(API)와 **똑같은 DB 함수**를 쓴다. 손으로 발급한다고 다른 경로를 타면
 *    계정당 1장 보장이 깨진다 — 자동으로 받아간 사람에게 또 줄 수 있다.
 *    이미 받아간 계정이면 새 코드를 만들지 않고 그때 준 코드를 그대로 돌려준다.
 */
export type ImportResult =
  | {
      success: true;
      /** 이번에 새로 반영된 건 */
      applied: number;
      /** 이미 같은 값으로 들어 있던 건 (다시 넣어도 안전하다) */
      unchanged: number;
      /** 코드가 이 캠페인에 없어 건너뛴 건 */
      notFound: string[];
      /** 같은 코드에 다른 아이디가 이미 있어 건드리지 않은 건 */
      conflicts: string[];
      /** 한 아이디가 여러 코드에 걸려 있어 건너뛴 건 */
      duplicateHandles: string[];
    }
  | { error: string };

/**
 * 외부 발송 도구의 CSV 를 읽어 "누가 어느 코드를 받아갔는지" 를 DB 에 반영한다.
 *
 * 왜 필요한가
 *   인스타 이벤트는 외부 도구로 DM 을 보낸다. 그 도구는 자기 안에만 기록을 남기므로,
 *   브라우저 데이터가 날아가면 복구할 방법이 없다. 우리 DB 로 옮겨 두면 매일 백업에 들어가고,
 *   어드민에서도 「받아간 계정」이 보여 문의에 바로 답할 수 있다.
 *
 * ⚠️ **이미 다른 아이디가 적힌 코드는 덮어쓰지 않는다.** 덮어쓰면 누가 진짜 받았는지
 *    영영 알 수 없어진다. 충돌한 건은 건드리지 않고 목록으로 돌려준다.
 *
 * ⚠️ 여러 번 넣어도 안전하다(멱등). 같은 CSV 를 다시 넣으면 전부 unchanged 로 잡힌다.
 */
export async function importIssuedHandles(
  campaignKey: string,
  csvText: string
): Promise<ImportResult> {
  try {
    const supabase = await requireAdmin();
    const rows = parseCsv(csvText);
    if (rows.length < 2) return { error: "CSV 내용이 비어 있어요." };

    const header = rows[0].map((h) => h.trim());
    const codeAt = header.findIndex((h) => h.includes("코드"));
    const handleAt = header.findIndex((h) => h.includes("아이디"));
    if (codeAt < 0 || handleAt < 0) {
      return { error: "CSV 에 '코드' 와 '인스타아이디' 칸이 있어야 해요." };
    }

    const { data: camp } = await supabase
      .from("coupon_campaigns").select("id").eq("key", campaignKey).single();
    if (!camp) return { error: "쿠폰 종류를 찾을 수 없어요." };

    const { data: existing, error: readErr } = await supabase
      .from("coupons").select("id, code, issued_to_handle").eq("campaign_id", camp.id);
    if (readErr) throw readErr;

    const byCode = new Map((existing ?? []).map((c) => [c.code as string, c]));
    // 이미 다른 코드에 붙어 있는 아이디. 유니크 제약에 걸리기 전에 미리 거른다.
    const handleOwner = new Map<string, string>();
    for (const c of existing ?? []) {
      if (c.issued_to_handle) handleOwner.set(c.issued_to_handle as string, c.code as string);
    }

    const notFound: string[] = [];
    const conflicts: string[] = [];
    const duplicateHandles: string[] = [];
    const toUpdate: { id: string; handle: string }[] = [];
    let unchanged = 0;

    for (const row of rows.slice(1)) {
      // 코드는 하이픈 없이 대문자로 저장돼 있다(E01Y-07TY → E01Y07TY).
      const code = (row[codeAt] ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
      const handle = (row[handleAt] ?? "").trim().replace(/^@+/, "").toLowerCase();
      if (!code || !handle) continue;  // 미발송 줄은 아이디가 비어 있다

      const coupon = byCode.get(code);
      if (!coupon) { notFound.push(code); continue; }

      const current = (coupon.issued_to_handle as string | null) ?? null;
      if (current === handle) { unchanged++; continue; }
      if (current) { conflicts.push(`${code} (DB: @${current} / CSV: @${handle})`); continue; }

      const owner = handleOwner.get(handle);
      if (owner && owner !== code) {
        duplicateHandles.push(`@${handle} (이미 ${owner})`);
        continue;
      }

      handleOwner.set(handle, code);
      toUpdate.push({ id: coupon.id as string, handle });
    }

    for (const u of toUpdate) {
      const { error } = await supabase
        .from("coupons").update({ issued_to_handle: u.handle }).eq("id", u.id);
      if (error) throw error;
    }

    await writeAuditLog({
      action: "coupon.issued",
      targetType: "coupon_campaign",
      targetId: campaignKey,
      summary: `발송 기록 CSV 반영 — ${toUpdate.length}건`,
      detail: { applied: toUpdate.length, unchanged, notFound: notFound.length,
                conflicts: conflicts.length },
    });

    revalidatePath("/admin/coupons");
    return {
      success: true as const,
      applied: toUpdate.length,
      unchanged,
      notFound: notFound.slice(0, 10),
      conflicts: conflicts.slice(0, 10),
      duplicateHandles: duplicateHandles.slice(0, 10),
    };
  } catch (err) {
    return toActionError(err, "CSV 반영 실패");
  }
}

export async function issueCouponToHandle(
  campaignKey: string,
  handle: string
): Promise<HandleIssueResult> {
  try {
    const supabase = await requireAdmin();
    if (!handle.trim()) return { error: "인스타 아이디를 입력해주세요." };

    const { data, error } = await supabase.rpc("assign_coupon_to_handle", {
      p_campaign_key: campaignKey,
      p_handle: handle,
    });
    if (error) throw error;

    const r = data as { ok?: boolean; code?: string; reused?: boolean; reason?: string };
    if (!r?.ok) {
      const 안내: Record<string, string> = {
        SOLD_OUT_OR_ENDED: "남은 쿠폰이 없거나 이벤트가 끝났습니다.",
        INVALID_HANDLE: "인스타 아이디를 확인해주세요.",
        CAMPAIGN_NOT_FOUND: "이 쿠폰 종류에는 연동 키가 없습니다.",
      };
      return { error: 안내[r?.reason ?? ""] ?? "발급하지 못했습니다." };
    }

    await writeAuditLog({
      action: "coupon.issued",
      targetType: "coupon_campaign",
      targetId: campaignKey,
      summary: `인스타 아이디로 쿠폰 발급 — ${r.reused ? "기존 코드 재안내" : "신규"}`,
    });

    revalidatePath("/admin/coupons");
    return { success: true as const, code: r.code ?? "", alreadyIssued: Boolean(r.reused) };
  } catch (err) {
    return toActionError(err, "쿠폰 발급 실패");
  }
}

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
    // ⚠️ I·L·O·U 로 발급하면 조회가 안 되는 쿠폰이 만들어진다(couponCode.ts 참고).
    if (!isValidCouponPrefix(input.prefix)) {
      return {
        error: `앞글자로 ${FORBIDDEN_PREFIXES.split("").join("·")} 는 쓸 수 없어요. ` +
          `숫자 1·0 과 헷갈려서 코드에서 제외한 글자라, 발급해도 조회되지 않습니다.`,
      };
    }

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
