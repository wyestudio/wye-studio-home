"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEligibleBirthYear, eligibleBirthYearRangeLabel } from "@/lib/eligibility";
import { getSessionById } from "@/lib/sessions";
import { sendApplicationSlackAlert } from "@/lib/slack";
import { isValidPhoneDigits, phoneDigits } from "@/lib/phone";
import { isDatingTheme } from "@/lib/theme";
import { sendApplicationConfirmationSms } from "@/lib/sms";
import {
  isValidKoreanName,
  isValidNickname,
  isValidNotes,
  isValidExperienceRange,
  type ExperienceRange,
} from "@/lib/validation";
import type { Application, Gender } from "@/types/domain";

export async function checkNicknameAvailability(
  sessionId: string,
  nickname: string
): Promise<{ available: boolean } | { error: string }> {
  if (!isValidNickname(nickname) || !nickname.trim()) {
    return { error: "닉네임 형식을 먼저 확인해주세요." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_nickname_available", {
    p_session_id: sessionId,
    p_nickname: nickname,
  });
  if (error) return { error: "확인 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." };
  return { available: data as boolean };
}

export async function checkActiveApplicationConflicts(
  phones: string[]
): Promise<{ conflictPhones: string[] } | { error: string }> {
  const digitsOnly = phones.map((p) => phoneDigits(p)).filter(Boolean);
  if (digitsOnly.length === 0) return { conflictPhones: [] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_active_applications", {
    p_phones: digitsOnly,
  });

  if (error) return { error: "확인 중 오류가 발생했어요." };
  return { conflictPhones: (data as string[]) ?? [] };
}

export type AttendeeInput = {
  name: string;
  phone: string;
  birthYear: number;
  nickname: string | null;
  gender: Gender | null;
  experienceRange: ExperienceRange | null;
};

export type ApplyState = {
  error?: string;
  application?: Application;
  attendees?: AttendeeInput[];
  notes?: string | null;
  conflictPhoneDigits?: string[];
  conflictReason?: "group" | "theme";
  closed?: boolean;
};

const ATTENDEE_FIELD_PATTERN = /^attendees\[(\d+)\]\[(name|phone|birthYear|nickname|gender|experienceRange)\]$/;

function parseAttendees(formData: FormData): AttendeeInput[] {
  const byIndex = new Map<
    number,
    Partial<Record<"name" | "phone" | "birthYear" | "nickname" | "gender" | "experienceRange", string>>
  >();

  for (const [key, value] of formData.entries()) {
    const match = key.match(ATTENDEE_FIELD_PATTERN);
    if (!match || typeof value !== "string") continue;
    const index = Number(match[1]);
    const field = match[2] as "name" | "phone" | "birthYear" | "nickname" | "gender" | "experienceRange";
    if (!byIndex.has(index)) byIndex.set(index, {});
    byIndex.get(index)![field] = value;
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, fields]) => {
      const expRange = fields.experienceRange ?? "";
      return {
        name: (fields.name ?? "").trim(),
        phone: (fields.phone ?? "").trim(),
        birthYear: Number(fields.birthYear),
        nickname: fields.nickname?.trim() || null,
        gender: fields.gender === "M" || fields.gender === "F" ? fields.gender : null,
        experienceRange: isValidExperienceRange(expRange) ? (expRange as ExperienceRange) : null,
      };
    });
}

export async function applyAction(
  _prevState: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const depositorName = String(formData.get("depositorName") ?? "").trim();
  const consentAgeSelf = formData.get("consentAgeSelf") === "on";
  const consentTerms = formData.get("consentTerms") === "on";
  const consentNoRebooking = formData.get("consentNoRebooking") === "on";
  const consentPii = formData.get("consentPii") === "on";
  const consentPhoneCollection = formData.get("consentPhoneCollection") === "on";
  const consentPrivacyPolicy = formData.get("consentPrivacyPolicy") === "on";
  const consentProxyForGroup = formData.get("consentProxyForGroup") === "on";
  const consentPhoto = formData.get("consentPhoto") === "on";
  const consentMarketing = formData.get("consentMarketing") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const attendees = parseAttendees(formData);

  if (!sessionId) {
    return { error: "잘못된 접근입니다." };
  }

  // theme_label을 알아야 소개팅 전용 검증(1인 신청/성별 필수)을 할 수 있어서
  // 성공 이후(after() 안)가 아니라 여기서 먼저 조회한다 — 알림 발송 때 다시
  // 조회하지 않고 이 값을 그대로 재사용한다.
  const session = await getSessionById(sessionId);
  if (!session) {
    return { error: "잘못된 접근입니다." };
  }
  const isDatingSession = isDatingTheme(session.theme_label);

  if (!depositorName) {
    return { error: "입금자명을 입력해주세요.", attendees, notes };
  }
  if (!isValidKoreanName(depositorName)) {
    return { error: "입금자명은 한글 2~10자만 가능합니다.", attendees, notes };
  }

  if (attendees.length === 0) {
    return { error: "참여 인원을 입력해주세요.", attendees, notes };
  }

  for (const attendee of attendees) {
    if (!attendee.name || !attendee.phone) {
      return { error: "참여자 이름과 전화번호를 모두 입력해주세요.", attendees, notes };
    }
    if (!isValidKoreanName(attendee.name)) {
      return { error: "참여자 이름은 한글 2~10자만 가능합니다.", attendees, notes };
    }
    if (!isValidPhoneDigits(phoneDigits(attendee.phone))) {
      return { error: "올바른 휴대폰 번호 형식이 아니에요.", attendees, notes };
    }
    if (!isEligibleBirthYear(attendee.birthYear, isDatingSession)) {
      return { error: `참여자 출생년도는 ${eligibleBirthYearRangeLabel(isDatingSession)}만 가능합니다.`, attendees, notes };
    }
    // 성별 (모든 테마에서 필수)
    if (!attendee.gender || (attendee.gender !== "M" && attendee.gender !== "F")) {
      return { error: "모든 참여자의 성별을 선택해주세요.", attendees, notes };
    }
    // 닉네임 (선택, 입력했을 때만 검사)
    if (attendee.nickname && !isValidNickname(attendee.nickname)) {
      return { error: "닉네임은 한글/영문 소문자/숫자 1~12자만 가능합니다.", attendees, notes };
    }
  }

  if (isDatingSession) {
    if (attendees.length !== 1) {
      return { error: "소개팅 회차는 1인 신청만 가능합니다.", attendees, notes };
    }
  }

  // 비고 검사 (그룹 전용, 선택)
  if (attendees.length >= 2 && notes && !isValidNotes(notes)) {
    return { error: "비고는 200자 이내이고, 한글/영문/숫자/기본 기호만 가능합니다.", attendees, notes };
  }

  const consentRequired = consentAgeSelf && consentTerms && consentNoRebooking && consentPii && consentPhoneCollection && consentPrivacyPolicy && consentProxyForGroup;
  if (!consentRequired) {
    return { error: "필수 약관에 모두 동의해야 신청할 수 있습니다.", attendees, notes };
  }

  const consentOptional = consentPhoto && consentMarketing;

  const digitCounts = new Map<string, number>();
  for (const attendee of attendees) {
    const digits = phoneDigits(attendee.phone);
    digitCounts.set(digits, (digitCounts.get(digits) ?? 0) + 1);
  }
  const selfConflictDigits = [...digitCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([digits]) => digits);
  if (selfConflictDigits.length > 0) {
    return {
      error: "그룹 안에서 전화번호가 중복돼요. 참여자별로 다른 전화번호를 입력해주세요.",
      attendees,
      conflictPhoneDigits: selfConflictDigits,
      conflictReason: "group",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("submit_application", {
      p_session_id: sessionId,
      p_depositor_name: depositorName,
      p_consent_required: consentRequired,
      p_consent_optional: consentOptional,
      p_attendees: attendees.map((a) => ({
        name: a.name,
        phone: a.phone,
        birth_year: a.birthYear,
        nickname: a.nickname,
        gender: a.gender,
        experience_range: a.experienceRange,
      })),
      p_notes: attendees.length >= 2 ? notes : null,
    })
    .single();

  if (error) {
    const isClosed = error.message.startsWith("정원마감:");
    const conflictPhoneDigits = error.details
      ? error.details.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const conflictReason = error.message.includes("그룹 안에서")
      ? "group"
      : error.message.includes("같은 테마") || error.message.includes("다른 테마")
        ? "theme"
        : undefined;
    return { error: error.message, attendees: isClosed ? undefined : attendees, notes: isClosed ? undefined : notes, conflictPhoneDigits, conflictReason, closed: isClosed };
  }

  const application = data as Application;

  after(async () => {
    try {
      const isTest = process.env.NEXT_PUBLIC_IS_TEST_ENV === "true";
      const tasks = [
        sendApplicationSlackAlert({ session, application, attendees, isTest }),
      ];
      if (!isTest) {
        tasks.push(sendApplicationConfirmationSms({ session, application, attendees }));
      }
      await Promise.all(tasks);
    } catch (err) {
      console.error("[notify] 신청 알림 처리 중 에러", err);
    }
  });

  return { application, attendees, notes };
}
