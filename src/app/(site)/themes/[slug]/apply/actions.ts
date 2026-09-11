"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicationConfirmationSmsV2 } from "@/lib/smsV2";

export type AttendeeInput = {
  name: string;
  phone: string;
  birth_year: number;
  nickname: string;
  gender: string;
  experience_range: string;
};

export type ApplyInput = {
  sessionId: string;
  depositorName: string;
  attendees: AttendeeInput[];
  notes: string;
  consentRequired: boolean;
  consentOptional: boolean;
  consentPhoto: boolean;
  consentMarketing: boolean;
};

export type ApplyResult =
  | {
      success: true;
      confirmationCode: string;
      status: "confirmed" | "waiting";
      headcount: number;
      unitPriceKrw: number;
      amountKrw: number;
      waitingNumber: number | null;
    }
  | { error: string; capacityFull?: true };

/**
 * 신청 제출.
 *
 * 검증은 전부 DB 의 submit_application_v2() 안에서 한다. 정원·재참여 배타는
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

  const { data, error } = await supabase.rpc("submit_application_v2", {
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
  });

  if (error) {
    const message = error.message ?? "신청에 실패했습니다.";
    // DB 가 '정원마감:' 접두사로 구분해 던진다 — 화면에서 다르게 안내하기 위함.
    if (message.startsWith("정원마감:")) {
      return { error: message.replace("정원마감:", "").trim(), capacityFull: true };
    }
    console.error("[apply] submit_application_v2 실패", error);
    return { error: message };
  }

  const r = data as {
    id: string;
    confirmation_code: string;
    status: "confirmed" | "waiting";
    headcount: number;
    unit_price_krw: number;
    amount_krw: number;
    waiting_number: number | null;
  };

  // ── 알림 ──────────────────────────────────────────────────────
  // ⚠️ 여기서 실패해도 신청은 이미 성공했다. 절대 사용자에게 에러를 돌려주지
  //    않는다. 로그만 남기고 넘어간다.
  //
  // 문자5(대기접수완료)는 발송하지 않기로 확정돼 있어(D-06 시대 결정)
  // 확정 건에만 문자1 을 보낸다. 대기자는 화면 안내로 충분하다.
  try {
    const isTest = process.env.NEXT_PUBLIC_IS_TEST_ENV === "true";
    if (!isTest && r.status === "confirmed") {
      const admin = createAdminClient();
      const { data: sv } = await admin
        .from("session_view")
        .select("theme_name, start_at, end_at, min_age")
        .eq("id", input.sessionId)
        .single();

      if (sv) {
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
    } else if (isTest) {
      console.log(`[apply] 테스트 환경이라 문자 발송을 건너뜁니다: ${r.confirmation_code}`);
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
    amountKrw: r.amount_krw,
    waitingNumber: r.waiting_number ?? null,
  };
}
