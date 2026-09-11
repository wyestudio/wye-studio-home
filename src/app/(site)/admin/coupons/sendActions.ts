"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import {
  buildCouponSms,
  getCouponTemplate,
  sendCouponSms,
  discountLabel,
  type SendOutcome,
} from "@/lib/couponSms";
import { formatCouponCode } from "@/lib/coupon";

/**
 * 쿠폰 수동 발송.
 *
 * 운영자가 대상을 눈으로 확인하고 고른 뒤 직접 보낸다. 자동 발송을 두지 않은
 * 것은 의도된 것이다 — 쿠폰은 한 번 나가면 회수할 수 없다.
 */

export type Recipient = {
  phoneHash: string;
  name: string;
  phone: string;
  isRepresentative: boolean;
  confirmationCode: string;
  /** 이 캠페인에서 이미 배정된 코드가 있으면 채워진다. */
  assignedCode: string | null;
};

export type RecipientsResult =
  | { ok: true; recipients: Recipient[] }
  | { ok: false; error: string };

export async function loadRecipients(input: {
  sessionId: string;
  campaignId: string;
  paidOnly: boolean;
}): Promise<RecipientsResult> {
  try {
    const supabase = await requireAdmin();

    const [rowsRes, assignedRes] = await Promise.all([
      supabase.rpc("coupon_recipients", {
        p_session_id: input.sessionId,
        p_paid_only: input.paidOnly,
      }),
      supabase
        .from("coupons")
        .select("code, issued_to_phone_hash")
        .eq("campaign_id", input.campaignId)
        .not("issued_to_phone_hash", "is", null),
    ]);

    if (rowsRes.error) throw rowsRes.error;

    const assigned = new Map<string, string>();
    for (const c of assignedRes.data ?? []) {
      if (c.issued_to_phone_hash) assigned.set(c.issued_to_phone_hash as string, c.code as string);
    }

    const rows = (rowsRes.data ?? []) as {
      phone_hash: string;
      name: string;
      phone: string;
      is_representative: boolean;
      confirmation_code: string;
    }[];

    return {
      ok: true,
      recipients: rows.map((r) => ({
        phoneHash: r.phone_hash,
        name: r.name,
        phone: r.phone,
        isRepresentative: r.is_representative,
        confirmationCode: r.confirmation_code,
        assignedCode: assigned.get(r.phone_hash) ?? null,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "대상을 불러오지 못했습니다." };
  }
}

export type PreviewResult = { ok: true; text: string } | { ok: false; error: string };

/** 실제 발송과 같은 함수로 만든다. 미리보기와 실물이 다르면 의미가 없다. */
export async function previewCouponSms(input: {
  campaignId: string;
  templateKey: string;
  sampleName: string;
}): Promise<PreviewResult> {
  try {
    const supabase = await requireAdmin();
    const [{ data: camp }, template] = await Promise.all([
      supabase.from("coupon_campaigns").select("*").eq("id", input.campaignId).single(),
      getCouponTemplate(input.templateKey),
    ]);

    if (!camp) return { ok: false, error: "쿠폰 종류를 찾을 수 없습니다." };
    if (!template) return { ok: false, error: `문자 문구(${input.templateKey})가 없습니다.` };

    return {
      ok: true,
      text: buildCouponSms(template.body, {
        name: input.sampleName || "홍길동",
        code: "M0EHEVG1",
        discount: discountLabel(camp.discount_type, camp.discount_value),
        expiresAt: camp.valid_until
          ? new Intl.DateTimeFormat("ko-KR", {
              timeZone: "Asia/Seoul",
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(new Date(camp.valid_until))
          : "제한 없음",
        link: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wouldyouescape.com"}/c/M0EHEVG1`,
      }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "미리보기 실패" };
  }
}

export type SendResult =
  | { ok: true; outcomes: (SendOutcome & { name: string; code: string })[] }
  | { ok: false; error: string };

export async function sendCoupons(input: {
  campaignId: string;
  templateKey: string;
  phoneHashes: string[];
}): Promise<SendResult> {
  try {
    if (input.phoneHashes.length === 0) return { ok: false, error: "보낼 대상을 선택해주세요." };

    const supabase = await requireAdmin();
    const [{ data: camp }, template] = await Promise.all([
      supabase.from("coupon_campaigns").select("*").eq("id", input.campaignId).single(),
      getCouponTemplate(input.templateKey),
    ]);

    if (!camp) return { ok: false, error: "쿠폰 종류를 찾을 수 없습니다." };
    if (!template) return { ok: false, error: `문자 문구(${input.templateKey})가 없습니다.` };

    const discount = discountLabel(camp.discount_type, camp.discount_value);
    const expiresAt = camp.valid_until
      ? new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(new Date(camp.valid_until))
      : "제한 없음";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wouldyouescape.com";

    // 이름·전화번호는 암호화돼 있어 해시만으로는 알 수 없다. 다시 조회한다.
    const outcomes: (SendOutcome & { name: string; code: string })[] = [];

    for (const phoneHash of input.phoneHashes) {
      // 1) 쿠폰 배정 — 이미 준 게 있으면 그걸 다시 쓴다(재발송 시 낭비 방지)
      const { data: assignRaw, error: assignErr } = await supabase.rpc("assign_coupon", {
        p_campaign_id: input.campaignId,
        p_phone_hash: phoneHash,
      });

      const assign = assignRaw as { ok: boolean; code?: string; reason?: string } | null;
      if (assignErr || !assign?.ok) {
        outcomes.push({
          phone: "",
          name: "",
          code: "",
          ok: false,
          detail: assign?.reason ?? assignErr?.message ?? "쿠폰 배정 실패",
        });
        continue;
      }

      // 2) 수신자 정보 — 복호화가 필요해 RPC 를 쓴다
      const { data: who } = await supabase.rpc("lookup_attendee_by_phone_hash", {
        p_phone_hash: phoneHash,
      });
      const person = (who as { name: string; phone: string }[] | null)?.[0];
      if (!person) {
        outcomes.push({ phone: "", name: "", code: assign.code!, ok: false, detail: "수신자 조회 실패" });
        continue;
      }

      const text = buildCouponSms(template.body, {
        name: person.name,
        code: assign.code!,
        discount,
        expiresAt,
        link: `${siteUrl}/c/${assign.code}`,
      });

      const result = await sendCouponSms(person.phone, text);
      outcomes.push({ ...result, name: person.name, code: formatCouponCode(assign.code!) });
    }

    revalidatePath("/admin/coupons");
    return { ok: true, outcomes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "발송 실패" };
  }
}
