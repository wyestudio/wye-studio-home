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
import { formatDateFull } from "@/lib/format";

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
  /** 본인 쿠폰이 이미 배정돼 있으면 채워진다. */
  assignedCode: string | null;
  /** 지인 쿠폰이 이미 배정돼 있으면 채워진다. */
  assignedFriendCode: string | null;
};

/** 캠페인 한 건의 할인·유효기간을 문자에 넣을 형태로 정리한다. */
type Campaign = {
  id: string;
  discount_type: string;
  discount_value: number;
  valid_until: string | null;
};

function partOf(camp: Campaign, code: string, siteUrl: string) {
  return {
    code,
    discount: discountLabel(camp.discount_type, camp.discount_value),
    // 'YYYY.MM.DD' — 화면·문자 전반에서 쓰는 표기와 같게.
    expiresAt: camp.valid_until ? formatDateFull(camp.valid_until) : "제한 없음",
    link: `${siteUrl}/c/${code}`,
  };
}

function siteUrlOf(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.wouldyouescape.com";
}

export type RecipientsResult =
  | { ok: true; recipients: Recipient[] }
  | { ok: false; error: string };

export async function loadRecipients(input: {
  sessionId: string;
  selfCampaignId: string;
  friendCampaignId: string;
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
        .select("code, campaign_id, issued_to_phone_hash")
        .in("campaign_id", [input.selfCampaignId, input.friendCampaignId])
        .not("issued_to_phone_hash", "is", null),
    ]);

    if (rowsRes.error) throw rowsRes.error;

    const assignedSelf = new Map<string, string>();
    const assignedFriend = new Map<string, string>();
    for (const c of assignedRes.data ?? []) {
      if (!c.issued_to_phone_hash) continue;
      const target = c.campaign_id === input.selfCampaignId ? assignedSelf : assignedFriend;
      target.set(c.issued_to_phone_hash as string, c.code as string);
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
        assignedCode: assignedSelf.get(r.phone_hash) ?? null,
        assignedFriendCode: assignedFriend.get(r.phone_hash) ?? null,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "대상을 불러오지 못했습니다." };
  }
}

export type PreviewResult = { ok: true; text: string } | { ok: false; error: string };

/** 실제 발송과 같은 함수로 만든다. 미리보기와 실물이 다르면 의미가 없다. */
export async function previewCouponSms(input: {
  selfCampaignId: string;
  friendCampaignId: string;
  templateKey: string;
  sampleName: string;
}): Promise<PreviewResult> {
  try {
    const supabase = await requireAdmin();
    const [{ data: camps }, template] = await Promise.all([
      supabase
        .from("coupon_campaigns")
        .select("id, discount_type, discount_value, valid_until")
        .in("id", [input.selfCampaignId, input.friendCampaignId]),
      getCouponTemplate(input.templateKey),
    ]);

    const byId = new Map((camps ?? []).map((c) => [c.id as string, c as Campaign]));
    const selfCamp = byId.get(input.selfCampaignId);
    const friendCamp = byId.get(input.friendCampaignId);
    if (!selfCamp || !friendCamp) return { ok: false, error: "쿠폰 종류를 찾을 수 없습니다." };
    if (!template) return { ok: false, error: `문자 문구(${input.templateKey})가 없습니다.` };

    const siteUrl = siteUrlOf();
    return {
      ok: true,
      text: buildCouponSms(template.body, {
        name: input.sampleName || "홍길동",
        self: partOf(selfCamp, "M0EHEVG1", siteUrl),
        friend: partOf(friendCamp, "K7WQ2XB4", siteUrl),
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
  selfCampaignId: string;
  friendCampaignId: string;
  templateKey: string;
  phoneHashes: string[];
}): Promise<SendResult> {
  try {
    if (input.phoneHashes.length === 0) return { ok: false, error: "보낼 대상을 선택해주세요." };

    const supabase = await requireAdmin();
    const [{ data: camps }, template] = await Promise.all([
      supabase
        .from("coupon_campaigns")
        .select("id, discount_type, discount_value, valid_until")
        .in("id", [input.selfCampaignId, input.friendCampaignId]),
      getCouponTemplate(input.templateKey),
    ]);

    const byId = new Map((camps ?? []).map((c) => [c.id as string, c as Campaign]));
    const selfCamp = byId.get(input.selfCampaignId);
    const friendCamp = byId.get(input.friendCampaignId);
    if (!selfCamp || !friendCamp) return { ok: false, error: "쿠폰 종류를 찾을 수 없습니다." };
    if (!template) return { ok: false, error: `문자 문구(${input.templateKey})가 없습니다.` };

    const siteUrl = siteUrlOf();

    /** 이미 준 게 있으면 그걸 다시 쓴다(재발송 시 낭비 방지). */
    async function assign(campaignId: string, phoneHash: string) {
      const { data, error } = await supabase.rpc("assign_coupon", {
        p_campaign_id: campaignId,
        p_phone_hash: phoneHash,
      });
      const res = data as { ok: boolean; code?: string; reason?: string } | null;
      if (error || !res?.ok || !res.code) {
        return { code: null as string | null, reason: res?.reason ?? error?.message ?? "쿠폰 배정 실패" };
      }
      return { code: res.code, reason: "" };
    }

    // 이름·전화번호는 암호화돼 있어 해시만으로는 알 수 없다. 다시 조회한다.
    const outcomes: (SendOutcome & { name: string; code: string })[] = [];

    for (const phoneHash of input.phoneHashes) {
      // ⚠️ 두 쿠폰을 모두 확보한 뒤에 보낸다. 하나만 배정된 채로 보내면
      //    문자에 빈 쿠폰번호가 찍히고, 배정된 쿠폰은 되돌릴 수 없다.
      const selfRes = await assign(input.selfCampaignId, phoneHash);
      if (!selfRes.code) {
        outcomes.push({ phone: "", name: "", code: "", ok: false, detail: `본인 쿠폰: ${selfRes.reason}` });
        continue;
      }
      const friendRes = await assign(input.friendCampaignId, phoneHash);
      if (!friendRes.code) {
        outcomes.push({
          phone: "",
          name: "",
          code: formatCouponCode(selfRes.code),
          ok: false,
          detail: `지인 쿠폰: ${friendRes.reason} (본인 쿠폰은 배정됨 — 미발송)`,
        });
        continue;
      }

      const { data: who } = await supabase.rpc("lookup_attendee_by_phone_hash", {
        p_phone_hash: phoneHash,
      });
      const person = (who as { name: string; phone: string }[] | null)?.[0];
      if (!person) {
        outcomes.push({
          phone: "",
          name: "",
          code: formatCouponCode(selfRes.code),
          ok: false,
          detail: "수신자 조회 실패",
        });
        continue;
      }

      const text = buildCouponSms(template.body, {
        name: person.name,
        self: partOf(selfCamp, selfRes.code, siteUrl),
        friend: partOf(friendCamp, friendRes.code, siteUrl),
      });

      const result = await sendCouponSms(person.phone, text);
      outcomes.push({
        ...result,
        name: person.name,
        code: `${formatCouponCode(selfRes.code)} / ${formatCouponCode(friendRes.code)}`,
      });
    }

    revalidatePath("/admin/coupons");
    return { ok: true, outcomes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "발송 실패" };
  }
}
