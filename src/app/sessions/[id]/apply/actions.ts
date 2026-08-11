"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEligibleBirthYear } from "@/lib/eligibility";
import { getSessionById } from "@/lib/sessions";
import { sendApplicationSlackAlert } from "@/lib/slack";
import type { Application, Gender } from "@/types/domain";

export type AttendeeInput = {
  name: string;
  phone: string;
  birthYear: number;
  nickname: string | null;
  // 소개팅 회차에서만 필수. 비소개팅은 항상 null.
  gender: Gender | null;
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

const ATTENDEE_FIELD_PATTERN = /^attendees\[(\d+)\]\[(name|phone|birthYear|nickname|gender)\]$/;

function parseAttendees(formData: FormData): AttendeeInput[] {
  const byIndex = new Map<number, Partial<Record<"name" | "phone" | "birthYear" | "nickname" | "gender", string>>>();

  for (const [key, value] of formData.entries()) {
    const match = key.match(ATTENDEE_FIELD_PATTERN);
    if (!match || typeof value !== "string") continue;
    const index = Number(match[1]);
    const field = match[2] as "name" | "phone" | "birthYear" | "nickname" | "gender";
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
      gender: fields.gender === "M" || fields.gender === "F" ? fields.gender : null,
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

  // theme_label을 알아야 소개팅 전용 검증(1인 신청/성별 필수)을 할 수 있어서
  // 성공 이후(after() 안)가 아니라 여기서 먼저 조회한다 — 알림 발송 때 다시
  // 조회하지 않고 이 값을 그대로 재사용한다.
  const session = await getSessionById(sessionId);
  if (!session) {
    return { error: "잘못된 접근입니다." };
  }
  const isDatingSession = session.theme_label === "소개팅";

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
  if (isDatingSession) {
    if (attendees.length !== 1) {
      return { error: "소개팅 회차는 1인 신청만 가능합니다.", attendees };
    }
    if (attendees[0].gender !== "M" && attendees[0].gender !== "F") {
      return { error: "성별을 선택해주세요.", attendees };
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
        gender: a.gender,
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
      // SMS 발송 임시 중단 (2026-08-11) — 팀원 테스트로 실제 문자 요금이 계속
      // 나가고 있어 급히 비활성화. 재활성화 시 src/lib/sms.ts의
      // sendApplicationConfirmationSms를 다시 import해서 아래 배열에 추가할 것.
      await Promise.all([sendApplicationSlackAlert({ session, application, attendees })]);
    } catch (err) {
      console.error("[notify] 신청 알림 처리 중 에러", err);
    }
  });

  return { application, attendees };
}
