"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEligibleBirthYear } from "@/lib/eligibility";
import { getSessionById } from "@/lib/sessions";
import { sendApplicationSlackAlert } from "@/lib/slack";
import { sendApplicationConfirmationSms } from "@/lib/sms";
import type { Application } from "@/types/domain";

export type AttendeeInput = {
  name: string;
  phone: string;
  birthYear: number;
  nickname: string | null;
};

export type ApplyState = {
  error?: string;
  application?: Application;
  attendees?: AttendeeInput[];
  // submit_application()이 전화번호 충돌 에러를 던질 때 DETAIL로 실어 보내는
  // 충돌 전화번호 목록(숫자만) — ApplyForm이 어떤 참여자 입력칸을 표시할지 판별.
  conflictPhoneDigits?: string[];
  // "group": 이번에 제출한 그룹 안에서 전화번호가 서로 중복됨
  // "theme": 이미 같은 테마에 참여한 적 있는 전화번호가 포함됨
  conflictReason?: "group" | "theme";
};

function phoneDigits(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

const ATTENDEE_FIELD_PATTERN = /^attendees\[(\d+)\]\[(name|phone|birthYear|nickname)\]$/;

function parseAttendees(formData: FormData): AttendeeInput[] {
  const byIndex = new Map<number, Partial<Record<"name" | "phone" | "birthYear" | "nickname", string>>>();

  for (const [key, value] of formData.entries()) {
    const match = key.match(ATTENDEE_FIELD_PATTERN);
    if (!match || typeof value !== "string") continue;
    const index = Number(match[1]);
    const field = match[2] as "name" | "phone" | "birthYear" | "nickname";
    if (!byIndex.has(index)) byIndex.set(index, {});
    byIndex.get(index)![field] = value;
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, fields]) => ({
      name: (fields.name ?? "").trim(),
      phone: (fields.phone ?? "").trim(),
      birthYear: Number(fields.birthYear),
      nickname: fields.nickname?.trim() || null,
    }));
}

export async function applyAction(
  _prevState: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const depositorName = String(formData.get("depositorName") ?? "").trim();
  const agreedTerms = formData.get("agreedTerms") === "on";
  const attendees = parseAttendees(formData);

  if (!sessionId) {
    return { error: "잘못된 접근입니다." };
  }
  if (!depositorName) {
    return { error: "입금자명을 입력해주세요.", attendees };
  }
  if (!agreedTerms) {
    return { error: "약관에 동의해야 신청할 수 있습니다.", attendees };
  }
  if (attendees.length === 0) {
    return { error: "참여 인원을 입력해주세요.", attendees };
  }
  for (const attendee of attendees) {
    if (!attendee.name || !attendee.phone) {
      return { error: "참여자 이름과 전화번호를 모두 입력해주세요.", attendees };
    }
    if (!isEligibleBirthYear(attendee.birthYear)) {
      return { error: "참여자 출생년도는 1990~1999년만 가능합니다.", attendees };
    }
  }

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
      p_agreed_terms: agreedTerms,
      p_attendees: attendees.map((a) => ({
        name: a.name,
        phone: a.phone,
        birth_year: a.birthYear,
        nickname: a.nickname,
      })),
    })
    .single();

  if (error) {
    const conflictPhoneDigits = error.details
      ? error.details.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const conflictReason = error.message.includes("그룹 안에서")
      ? "group"
      : error.message.includes("같은 테마")
        ? "theme"
        : undefined;
    return { error: error.message, attendees, conflictPhoneDigits, conflictReason };
  }

  const application = data as Application;

  after(async () => {
    try {
      const session = await getSessionById(sessionId);
      if (!session) return;
      await Promise.all([
        sendApplicationSlackAlert({ session, application, attendees }),
        sendApplicationConfirmationSms({ session, application, attendees }),
      ]);
    } catch (err) {
      console.error("[notify] 신청 알림 처리 중 에러", err);
    }
  });

  return { application, attendees };
}
