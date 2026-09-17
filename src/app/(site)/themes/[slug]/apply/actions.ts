"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicationConfirmationSmsV2 } from "@/lib/smsV2";
import { sendApplicationSlackAlertV2 } from "@/lib/slackV2";
import { formatSessionDateTime } from "@/lib/format";
import { isValidNickname } from "@/lib/validation";
import { phoneDigits } from "@/lib/phone";
import type { Attribution } from "@/lib/attribution";
import { recordAttribution } from "@/lib/attributionServer";
import { isInternalDevice, markInternalApplication } from "@/lib/internalTraffic";

export type AttendeeInput = {
  name: string;
  phone: string;
  birth_year: number;
  nickname: string;
  gender: string;
  experience_range: string;
};

/**
 * 닉네임 중복 확인. 같은 회차 안에서만 유일하면 된다
 * (application_attendees 의 unique(session_id, nickname) 과 같은 기준).
 */
export async function checkNickname(
  sessionId: string,
  nickname: string
): Promise<{ available: boolean } | { error: string }> {
  if (!nickname.trim() || !isValidNickname(nickname)) {
    return { error: "닉네임 형식을 먼저 확인해주세요." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_nickname_available", {
    p_session_id: sessionId,
    p_nickname: nickname.trim(),
  });
  if (error) return { error: "확인 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." };
  return { available: data as boolean };
}

/**
 * 같은 테마에 이미 신청한 번호가 있는지 미리 확인한다.
 *
 * ⚠️ 화면에서 일찍 알려주려는 것일 뿐이다. 최종 판정은 submit_application_v3()
 *    안에서 행을 잠그고 한다 — 동시 요청은 여기서 막을 수 없다.
 */
export async function checkThemeConflicts(
  phones: string[],
  sessionId: string
): Promise<{ conflictPhones: string[] } | { error: string }> {
  const digits = phones.map((p) => phoneDigits(p)).filter(Boolean);
  if (digits.length === 0) return { conflictPhones: [] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_active_applications_v2", {
    p_phones: digits,
    p_session_id: sessionId,
  });
  if (error) return { error: "확인 중 오류가 발생했어요." };
  return { conflictPhones: (data as string[]) ?? [] };
}

export type ApplyInput = {
  sessionId: string;
  /** 적용할 쿠폰 코드들. 중복 가능한 캠페인끼리는 여러 장. */
  couponCodes: string[];
  depositorName: string;
  attendees: AttendeeInput[];
  notes: string;
  consentRequired: boolean;
  consentOptional: boolean;
  consentPhoto: boolean;
  consentMarketing: boolean;
  /** 유입경로. 첫 도착 때 잡아둔 값이며 없을 수 있다(직접 방문). */
  attribution?: Attribution | null;
};

export type ApplyResult =
  | {
      success: true;
      confirmationCode: string;
      status: "confirmed" | "waiting";
      headcount: number;
      unitPriceKrw: number;
      baseAmountKrw: number;
      discountKrw: number;
      amountKrw: number;
      waitingNumber: number | null;
    }
  | { error: string; capacityFull?: true };

/** 적용된 쿠폰 한 장 */
export type AppliedCoupon = {
  code: string;
  campaignName: string;
  discountKrw: number;
};

export type CouponPreview =
  | {
      ok: true;
      /** 적용된 쿠폰들. 중복 가능한 캠페인끼리는 여러 장이 올 수 있다. */
      items: AppliedCoupon[];
      /** 전부 합친 할인액 */
      discountKrw: number;
      finalAmountKrw: number;
    }
  | { ok: false; reason: string };

/**
 * 쿠폰 확인. 신청 전에 화면에서 할인액을 보여주기 위한 것이다.
 *
 * 판정 규칙은 DB 의 preview_coupon() 한 곳에만 있다. 화면과 실제 신청이
 * 다른 규칙을 쓰면 "화면에는 할인이 떴는데 신청하니 안 먹는" 일이 생긴다.
 */
export async function checkCoupon(input: {
  /** 지금까지 적용된 코드 + 새로 넣은 코드. 합쳐서 판정한다. */
  codes: string[];
  themeId: string;
  headcount: number;
  baseAmountKrw: number;
  phone: string;
}): Promise<CouponPreview> {
  const codes = input.codes.map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) return { ok: false, reason: "쿠폰 코드를 입력해주세요." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_coupons", {
    p_codes: codes,
    p_theme_id: input.themeId,
    p_headcount: input.headcount,
    p_base_amount: input.baseAmountKrw,
    p_phone: input.phone.replace(/\D/g, "") || null,
  });

  if (error) {
    console.error("[apply] preview_coupons 실패", error);
    return { ok: false, reason: "쿠폰을 확인하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  const r = data as Record<string, unknown>;
  if (!r?.ok) return { ok: false, reason: String(r?.reason ?? "사용할 수 없는 쿠폰이에요.") };

  return {
    ok: true,
    items: ((r.items as Record<string, unknown>[]) ?? []).map((i) => ({
      code: String(i.code),
      campaignName: String(i.campaign_name),
      discountKrw: Number(i.discount_krw),
    })),
    discountKrw: Number(r.discount_krw),
    finalAmountKrw: Number(r.final_amount_krw),
  };
}

/**
 * 신청 제출.
 *
 * 검증은 전부 DB 의 submit_application_v3() 안에서 한다. 정원·재참여 배타는
 * 동시 요청을 직렬화해야 정확하므로 애플리케이션에서 미리 판단하면 안 된다.
 * (select ... for update 로 잠근 뒤 판정한다)
 */
export async function applyToSession(input: ApplyInput): Promise<ApplyResult> {
  // 화면에서 바로 걸러낼 수 있는 것만 사전 검사한다. 최종 판정은 DB 다.
  if (!input.consentRequired) return { error: "필수 약관에 동의해주세요." };
  if (!input.depositorName.trim()) return { error: "입금자명을 입력해주세요." };
  if (input.attendees.length === 0) return { error: "참여자 정보를 입력해주세요." };

  for (const [i, a] of input.attendees.entries()) {
    const label = i === 0 ? "신청자" : `동행자 ${i}`;
    if (!a.name.trim()) return { error: `${label}의 이름을 입력해주세요.` };
    if (!/^01[016789]\d{7,8}$/.test(a.phone.replace(/\D/g, "")))
      return { error: `${label}의 휴대폰 번호를 정확히 입력해주세요.` };
    if (!a.birth_year) return { error: `${label}의 출생연도를 선택해주세요.` };
  }

  const supabase = await createClient();

  // 로그인 상태면 신청을 계정에 붙인다. 비회원 신청도 그대로 받는다(D-06).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ⚠️ v3 를 쓴다. v2 는 쿠폰 1장 시절 함수이며 **그대로 살려둔다**(p37).
  const { data, error } = await supabase.rpc("submit_application_v3", {
    p_session_id: input.sessionId,
    p_depositor_name: input.depositorName.trim(),
    p_consent_required: input.consentRequired,
    p_consent_optional: input.consentOptional,
    p_attendees: input.attendees.map((a) => ({
      name: a.name.trim(),
      phone: a.phone.replace(/\D/g, ""),
      birth_year: a.birth_year,
      nickname: a.nickname.trim() || null,
      gender: a.gender || null,
      experience_range: a.experience_range || null,
    })),
    p_notes: input.notes.trim() || null,
    p_consent_photo: input.consentPhoto,
    p_consent_marketing: input.consentMarketing,
    p_coupon_codes: input.couponCodes.map((c) => c.trim()).filter(Boolean),
    p_user_id: user?.id ?? null,
  });

  if (error) {
    const message = error.message ?? "신청에 실패했습니다.";
    // DB 가 '정원마감:' 접두사로 구분해 던진다 — 화면에서 다르게 안내하기 위함.
    if (message.startsWith("정원마감:")) {
      return { error: message.replace("정원마감:", "").trim(), capacityFull: true };
    }
    console.error("[apply] submit_application_v3 실패", error);
    return { error: message };
  }

  const r = data as {
    id: string;
    confirmation_code: string;
    status: "confirmed" | "waiting";
    headcount: number;
    unit_price_krw: number;
    base_amount_krw: number;
    discount_krw: number;
    amount_krw: number;
    waiting_number: number | null;
    /** v3 가 돌려주는, 실제로 적용된 쿠폰들 */
    coupons?: { code: string; campaign_name: string; discount_krw: number }[];
  };

  // 유입경로를 신청 건에 붙인다. 근거와 주의사항은 attributionServer.ts 에 있다.
  await recordAttribution(r.id, input.attribution);
  // 우리 기기에서 넣은 신청이면 분석에서 빼도록 표시한다(internalTraffic.ts).
  await markInternalApplication(r.id, await isInternalDevice());

  // ── 알림 ──────────────────────────────────────────────────────
  // ⚠️ 여기서 실패해도 신청은 이미 성공했다. 절대 사용자에게 에러를 돌려주지
  //    않는다. 로그만 남기고 넘어간다.
  //
  // 문자5(대기접수완료)는 발송하지 않기로 확정돼 있어(D-06 시대 결정)
  // 확정 건에만 문자1 을 보낸다. 대기자는 화면 안내로 충분하다.
  try {
    const isTest = process.env.NEXT_PUBLIC_IS_TEST_ENV === "true";
    if (!isTest) {
      const admin = createAdminClient();
      const { data: sv } = await admin
        .from("session_view")
        .select("theme_name, start_at, end_at, min_age")
        .eq("id", input.sessionId)
        .single();

      if (sv && r.status === "confirmed") {
        await sendApplicationConfirmationSmsV2({
          session: {
            themeName: sv.theme_name as string,
            startAt: sv.start_at as string,
            endAt: (sv.end_at as string) ?? null,
            minAge: sv.min_age as number,
          },
          to: input.attendees[0].phone,
          recipientName: input.attendees[0].name.trim(),
          confirmationCode: r.confirmation_code,
          headcount: r.headcount,
          amountKrw: r.amount_krw,
          depositorName: input.depositorName.trim(),
        });
      }

      // ⚠️ Slack 알림은 **대기 건도** 보낸다. 문자5(대기접수완료)를 안 보내기로
      //    한 것은 고객 대상 결정이고, 운영자는 대기 신청도 알아야 한다.
      //    2026-09-13 이전에는 이 호출 자체가 없어서 신규 신청이 Slack 에
      //    전혀 뜨지 않았다(레거시 폼에만 붙어 있었다).
      if (sv) {
        await sendApplicationSlackAlertV2({
          sessionId: input.sessionId,
          themeName: sv.theme_name as string,
          sessionLabel: formatSessionDateTime(sv.start_at as string),
          confirmationCode: r.confirmation_code,
          status: r.status,
          createdAt: new Date().toISOString(),
          headcount: r.headcount,
          amountKrw: r.amount_krw,
          discountKrw: r.discount_krw,
          // 어느 쿠폰을 썼는지 운영자가 알림에서 바로 보게 한다.
          coupons: (r.coupons ?? []).map((c) => ({
            code: c.code,
            campaignName: c.campaign_name,
            discountKrw: c.discount_krw,
          })),
          depositorName: input.depositorName.trim(),
          notes: input.notes.trim() || null,
          // ⚠️ 동행자까지 전부 넘긴다. 슬랙 포맷에서 {{#attendees}} 블록으로
          //    누구를 어떤 항목까지 보여줄지 운영자가 정한다.
          attendees: input.attendees.map((a) => ({
            name: a.name.trim(),
            phone: a.phone.replace(/\D/g, ""),
            nickname: a.nickname?.trim() || null,
            birthYear: a.birth_year,
            gender: a.gender || null,
            experienceRange: a.experience_range || null,
          })),
        });
      }
    } else {
      console.log(`[apply] 테스트 환경이라 문자·Slack 발송을 건너뜁니다: ${r.confirmation_code}`);
    }
  } catch (err) {
    console.error("[apply] 신청 후 알림 처리 실패 (신청 자체는 성공)", err);
  }

  return {
    success: true,
    confirmationCode: r.confirmation_code,
    status: r.status,
    headcount: r.headcount,
    unitPriceKrw: r.unit_price_krw,
    baseAmountKrw: r.base_amount_krw ?? r.amount_krw,
    discountKrw: r.discount_krw ?? 0,
    amountKrw: r.amount_krw,
    waitingNumber: r.waiting_number ?? null,
  };
}
