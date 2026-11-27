"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { GROUP_BOOKING_THEME_SLUGS } from "@/lib/groupBooking";
import { GROUP_CLOSURES_TAG } from "@/lib/groupClosures";
import { BASE_MINUTES, CLOSURE_BUFFER_MINUTES, HHMM, ISO_DATE, addMinutes } from "@/lib/groupPricing";
import { closeOverlappingSessions, closureLabel } from "@/lib/groupClosureOps";

/**
 * 단체 일정 막기 · 풀기(홈 달력의 「이날 단체 막기」 · 파티 회차의 「단체 막기」).
 *
 * 예전에 여기 있던 「진행 상태 저장」(saveInquiryStatus) · 「문의 정보 수정」(saveInquiryInfo)은 관리자 개편으로
 * groupActions.ts 의 입금 확인 · 금액 변경으로 바뀌어 지웠다(2026-11-27 대표님 확인). 단계는 이제 운영자가
 * 직접 고르지 않고 동작에 따라 넘어간다.
 */
type ClosureInput = {
  date: string;
  time: string | null;
  /** time 부터 몇 분. time 이 null(종일)이면 무시한다. */
  minutes: number | null;
};

/** 잘못된 값이면 안내 문구, 괜찮으면 null. */
function validateClosure(c: ClosureInput): string | null {
  if (!ISO_DATE.test(c.date)) return "날짜를 확인해주세요.";
  if (c.time !== null && !HHMM.test(c.time)) return "시간을 확인해주세요.";
  if (c.time !== null && c.minutes === null) return "소요 시간을 입력해주세요.";
  if (c.time !== null && (!Number.isInteger(c.minutes) || c.minutes! < 10 || c.minutes! > 1440)) {
    return "소요 시간을 확인해주세요(10분 ~ 24시간).";
  }
  return null;
}

/**
 * 단체 견적 화면에서 고를 수 없게 날짜·시간 구간을 막는다.
 *
 * 단체 일정 데이터가 따로 없어서 견적은 '희망 일시' 로 받는다. 다른 단체가 입금해
 * 확정된 날처럼 이미 찬 일정만 여기서 막는다(2026-10-25 대표님). time 이 null 이면 종일.
 * 아니면 time 부터 minutes 분 동안이다 — 회차(11:30 등)가 아니라 구간으로 받는다
 * (2026-10-30 대표님, 평일 · 주말 모두 시간이 계속 조정된다). 그 구간과 겹치는 단체 시간은 못 고른다.
 * ⚠️ 막는 순간 고객 화면(캐시 60초 안)과 접수 함수 양쪽에 걸린다.
 *
 * 같은 장소에서 시간이 겹치는 일반 회차(파티 · 노말 모드)도 같이 닫는다(2026-10-26 대표님).
 * 단체가 공간을 통째로 쓰기 때문이다. 단, 신청자가 있는 회차는 닫지 않고 알려만 준다 —
 * 이미 받은 손님을 어떻게 할지는 사람이 정한다.
 */
export async function addGroupClosure(input: ClosureInput & { note: string }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const c = { date: input.date, time: input.time, minutes: input.time === null ? null : input.minutes };
    const bad = validateClosure(c);
    if (bad) return { error: bad };

    const message = await insertClosure(supabase, c, input.note.trim() || null, null);
    updateTag(GROUP_CLOSURES_TAG);
    revalidatePath("/admin/group-bookings");
    revalidatePath("/admin/sessions");
    return { success: true, message };
  } catch (err) {
    return toActionError(err, "마감 표시에 실패했습니다.");
  }
}

/** 마감 한 줄을 넣고 겹치는 회차를 닫는다. 화면에 띄울 결과 문구를 돌려준다. */
async function insertClosure(
  supabase: AdminClient,
  c: ClosureInput,
  note: string | null,
  inquiryId: string | null
): Promise<string> {
  const { data, error } = await supabase
    .from("group_booking_closures")
    .insert({ date: c.date, start_time: c.time, minutes: c.minutes, note, inquiry_id: inquiryId })
    .select("id")
    .single();
  if (error) throw error;

  const label = closureLabel(c.date, c.time, c.minutes);
  const sessions = await closeOverlappingSessions(supabase, c.date, c.time, c.minutes, label);
  await writeAuditLog({
    action: "group_booking.closure_added",
    targetType: "group_booking_closure",
    targetId: (data as { id: string }).id,
    summary: `단체 일정 마감 ${label}${inquiryId ? " (예약 확정)" : ""}${sessions.closed.length ? ` — 겹치는 회차 ${sessions.closed.length}개 마감` : ""}`,
    detail: { ...c, inquiryId, closedSessions: sessions.closed, keptSessions: sessions.kept },
  });

  const parts = [`${label} 을 마감으로 표시했습니다.`];
  if (c.time) {
    const b = CLOSURE_BUFFER_MINUTES;
    // 앞쪽은 자정 전으로 넘기지 않는다(closureSlots 와 같다).
    const before = Math.min(b, Number(c.time.slice(0, 2)) * 60 + Number(c.time.slice(3, 5)));
    parts.push(
      `세팅 · 정리 시간을 더해 ${addMinutes(c.time, -before)}~${addMinutes(c.time, (c.minutes ?? BASE_MINUTES) + b)} 신청을 막습니다.`
    );
  }
  if (sessions.closed.length) parts.push(`겹치는 회차 ${sessions.closed.length}개도 닫았습니다(${sessions.closed.join(", ")}).`);
  if (sessions.kept.length)
    parts.push(`신청자가 있어 열어 둔 회차: ${sessions.kept.join(", ")} — 회차 관리에서 직접 확인해주세요.`);
  return parts.join(" ");
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>;

/**
 * 파티모드 회차의 「단체 막기」 켜고 끄기(2026-10-30 대표님).
 *
 * 파티는 신청이 있어도 인원 미달로 닫힐 수 있어 단체를 자동으로 막지 않는다. 회차가 확정되면
 * 운영자가 켜서 그 회차 시간(시작 ~ 끝)과 겹치는 단체 신청을 막는다.
 * ⚠️ 다른 회차는 닫지 않는다 — 파티와 노말은 시간이 겹치지 않고, 파티 회차 자신을 닫으면 안 된다.
 */
export async function setSessionGroupBlock(sessionId: string, on: boolean): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    if (!on) {
      const { data, error } = await supabase
        .from("group_booking_closures")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) return { error: error.message };
      if (data) await deleteClosure(supabase, (data as { id: string }).id);
      updateTag(GROUP_CLOSURES_TAG);
      revalidatePath("/admin");
      revalidatePath("/admin/group-bookings");
      return { success: true, message: "단체 막기를 풀었습니다." };
    }

    const { data: s, error } = await supabase
      .from("sessions")
      .select("start_at, end_at, themes!inner(slug)")
      .eq("id", sessionId)
      .single();
    if (error) return { error: error.message };
    const row = s as { start_at: string; end_at: string; themes: { slug: string } | { slug: string }[] };
    const slug = (Array.isArray(row.themes) ? row.themes[0] : row.themes)?.slug;
    if (!slug || !GROUP_BOOKING_THEME_SLUGS.includes(slug)) {
      return { error: "단체 예약을 받는 테마(파티모드)의 회차만 막을 수 있어요." };
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(row.start_at));
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    const time = `${get("hour")}:${get("minute")}`;
    const minutes = Math.min(1440, Math.round((new Date(row.end_at).getTime() - new Date(row.start_at).getTime()) / 60_000));
    if (!(minutes >= 10)) return { error: "회차의 시작 · 끝 시각을 확인해주세요." };

    const { data: ins, error: insErr } = await supabase
      .from("group_booking_closures")
      .insert({ date, start_time: time, minutes, session_id: sessionId })
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") return { success: true, message: "이미 단체를 막아 둔 회차입니다." };
      return { error: insErr.message };
    }
    const label = closureLabel(date, time, minutes);
    await writeAuditLog({
      action: "group_booking.closure_added",
      targetType: "group_booking_closure",
      targetId: (ins as { id: string }).id,
      summary: `단체 일정 마감 ${label} (파티 회차 단체 막기)`,
      detail: { date, time, minutes, sessionId },
    });

    updateTag(GROUP_CLOSURES_TAG);
    revalidatePath("/admin");
    revalidatePath("/admin/group-bookings");
    return { success: true, message: `${label} 단체 신청을 막았습니다.` };
  } catch (err) {
    return toActionError(err, "단체 막기에 실패했습니다.");
  }
}

export async function removeGroupClosure(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const label = await deleteClosure(supabase, id);
    updateTag(GROUP_CLOSURES_TAG);
    revalidatePath("/admin/group-bookings");
    return { success: true, message: `${label} 마감을 풀었습니다.` };
  } catch (err) {
    return toActionError(err, "마감 해제에 실패했습니다.");
  }
}

/**
 * 마감 한 줄을 지운다. 지운 구간의 이름을 돌려준다.
 * ⚠️ 여기서 닫았던 회차는 다시 열지 않는다(closeOverlappingSessions 주석).
 */
async function deleteClosure(supabase: AdminClient, id: string): Promise<string> {
  const { data, error } = await supabase
    .from("group_booking_closures")
    .delete()
    .eq("id", id)
    .select("date, start_time, minutes, inquiry_id")
    .single();
  if (error) throw error;

  const row = data as { date: string; start_time: string | null; minutes: number | null; inquiry_id: string | null };
  const label = closureLabel(row.date, row.start_time, row.minutes);
  await writeAuditLog({
    action: "group_booking.closure_removed",
    targetType: "group_booking_closure",
    targetId: id,
    summary: `단체 일정 마감 해제 ${label}`,
    detail: { date: row.date, time: row.start_time, minutes: row.minutes, inquiryId: row.inquiry_id },
  });
  return label;
}
