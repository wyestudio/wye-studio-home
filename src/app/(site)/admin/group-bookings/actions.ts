"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { GROUP_BOOKING_THEME_SLUGS, isInquiryStatus, inquiryStatusLabel } from "@/lib/groupBooking";
import { GROUP_CLOSURES_TAG } from "@/lib/groupClosures";
import { BASE_MINUTES, HHMM, ISO_DATE, addMinutes } from "@/lib/groupPricing";
import { kstToUtcIso } from "@/lib/scheduleRules";

/**
 * 단체 예약 문의의 진행 상태·메모 저장.
 *
 * 금액이 바뀌는 작업이 아니다(견적은 사람이 따로 안내한다) — 여기 값은 **어디까지
 * 응대했는지** 를 적는 운영 메모다. 그래도 누가 언제 바꿨는지는 남긴다. 접수함을
 * 둘이 나눠 보면 "이거 연락했나" 가 반드시 겹친다.
 *
 * '예약 확정' 이면 확정 일시(booking)로 마감을 만든다 — 그 시간과 겹치는 단체 · 일반 회차를
 * 더 받지 않게(2026-10-30 대표님). 확정 일시는 희망 일시와 다를 수 있어(15:30 신청 → 13:30
 * 안내) 운영자가 넣은 값을 쓴다. 확정 일시를 바꾸면 마감도 옮기고, 확정에서 다른 상태로
 * 돌리면 마감을 푼다. 마감은 group_booking_closures.inquiry_id 로 이 신청 건과 이어진다.
 */
export async function saveInquiryStatus(input: {
  id: string;
  status: string;
  memo: string;
  booking: ClosureInput | null;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    if (!isInquiryStatus(input.status)) {
      return { error: "알 수 없는 상태입니다." };
    }
    const booked = input.status === "booked";
    if (booked) {
      if (!input.booking || input.booking.time === null) return { error: "확정 날짜 · 시작 시각 · 소요 시간을 넣어주세요." };
      const bad = validateClosure(input.booking);
      if (bad) return { error: bad };
    }

    const { error } = await supabase
      .from("group_booking_inquiries")
      .update({
        status: input.status,
        admin_memo: input.memo.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) return { error: error.message };

    await writeAuditLog({
      action: "group_booking.updated",
      targetType: "group_booking_inquiry",
      targetId: input.id,
      summary: `단체 예약 문의 ${inquiryStatusLabel(input.status)}`,
    });

    // 이 신청 건에 이어진 마감. 확정 일시가 그대로면 손대지 않는다(회차를 다시 닫으러 가지 않게).
    const { data: linkedRow, error: linkErr } = await supabase
      .from("group_booking_closures")
      .select("id, date, start_time, minutes")
      .eq("inquiry_id", input.id)
      .maybeSingle();
    if (linkErr) throw linkErr;
    const linked = linkedRow as { id: string; date: string; start_time: string | null; minutes: number | null } | null;
    const b = booked ? input.booking! : null;
    const same = !!linked && !!b && linked.date === b.date && linked.start_time === b.time && linked.minutes === b.minutes;

    const parts = ["저장했습니다."];
    if (linked && !same) {
      await deleteClosure(supabase, linked.id);
      if (!b) parts.push(`확정 일시(${closureLabel(linked.date, linked.start_time, linked.minutes)}) 마감을 풀었습니다.`);
    }
    if (b && !same) {
      // 메모는 비운다 — 목록에서 신청 건 이름으로 보여 준다(ClosureManager).
      const res = await insertClosure(supabase, b, null, input.id);
      parts.push(res);
    }

    updateTag(GROUP_CLOSURES_TAG);
    revalidatePath("/admin/group-bookings");
    revalidatePath("/admin/sessions");
    return { success: true, message: parts.join(" ") };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

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
  if (sessions.closed.length) parts.push(`겹치는 회차 ${sessions.closed.length}개도 닫았습니다(${sessions.closed.join(", ")}).`);
  if (sessions.kept.length)
    parts.push(`신청자가 있어 열어 둔 회차: ${sessions.kept.join(", ")} — 회차 관리에서 직접 확인해주세요.`);
  return parts.join(" ");
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>;

/** '2026-11-01 15:30~18:30' · '2026-11-01 종일'. 감사 기록과 회차 메모에 남는다. */
function closureLabel(date: string, time: string | null, minutes: number | null): string {
  if (time === null) return `${date} 종일`;
  return `${date} ${time}~${addMinutes(time, minutes ?? BASE_MINUTES)}`;
}

/** 회차 한 줄 표시용 'HH:MM 테마이름' (KST). */
function sessionLabel(startAt: string, themeName: string | null): string {
  const hm = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(startAt));
  return `${hm}${themeName ? ` ${themeName}` : ""}`;
}

/**
 * 막은 구간(시작 ~ 소요 시간, 종일이면 그날 전체)과 겹치는 같은 장소의 열린 회차를 닫는다.
 * 장소는 단체 예약 테마(바-ㅇ탈출)의 장소로 본다 — 파티 · 노말 모드가 같은 공간을 쓴다.
 * 신청자(취소 제외)가 있는 회차는 닫지 않고 kept 로 돌려준다.
 * ⚠️ 마감을 풀어도 여기서 닫은 회차는 다시 열지 않는다(그 사이 사정이 바뀌었을 수 있다).
 */
async function closeOverlappingSessions(
  supabase: AdminClient,
  date: string,
  time: string | null,
  minutes: number | null,
  label: string
): Promise<{ closed: string[]; kept: string[] }> {
  const from = kstToUtcIso(date, time ?? "00:00");
  const to = time
    ? new Date(new Date(from).getTime() + (minutes ?? BASE_MINUTES) * 60_000).toISOString()
    : kstToUtcIso(date, "23:59");

  const { data: groupTheme } = await supabase
    .from("themes")
    .select("venue_id")
    .in("slug", [...GROUP_BOOKING_THEME_SLUGS])
    .limit(1)
    .maybeSingle();
  const venueId = (groupTheme as { venue_id: string | null } | null)?.venue_id ?? null;
  if (!venueId) return { closed: [], kept: [] };

  // 겹침: 회차 시작 < 단체 끝 && 회차 끝 > 단체 시작
  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, start_at, end_at, status, admin_note, venue_id_override, themes!inner(name, variant_label, venue_id)")
    .eq("status", "open")
    .lt("start_at", to)
    .gt("end_at", from);
  if (error) throw error;

  type ThemeRef = { name: string | null; variant_label: string | null; venue_id: string | null };
  type Row = {
    id: string;
    start_at: string;
    admin_note: string | null;
    venue_id_override: string | null;
    themes: ThemeRef | ThemeRef[];
  };
  const candidates = ((rows ?? []) as Row[])
    .map((r) => ({ ...r, theme: Array.isArray(r.themes) ? r.themes[0] : r.themes }))
    .filter((r) => (r.venue_id_override ?? r.theme?.venue_id) === venueId);
  if (candidates.length === 0) return { closed: [], kept: [] };

  const { data: apps, error: appsErr } = await supabase
    .from("applications")
    .select("session_id")
    .in(
      "session_id",
      candidates.map((c) => c.id)
    )
    .neq("status", "cancelled");
  if (appsErr) throw appsErr;
  const busy = new Set(((apps ?? []) as { session_id: string }[]).map((a) => a.session_id));

  const closed: string[] = [];
  const kept: string[] = [];
  const note = `단체 대관(${label})으로 마감`;
  for (const c of candidates) {
    // 파티 · 노말 모드가 이름이 같다 — 모드 이름(variant_label)이 있으면 그걸로 가른다.
    const name = sessionLabel(c.start_at, c.theme?.variant_label ?? c.theme?.name ?? null);
    if (busy.has(c.id)) {
      kept.push(name);
      continue;
    }
    const { error: upErr } = await supabase
      .from("sessions")
      .update({
        status: "closed",
        closed_by_team_limit: false,
        admin_note: [c.admin_note, note].filter(Boolean).join("\n"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id)
      .eq("status", "open");
    if (upErr) throw upErr;
    await writeAuditLog({
      action: "session.status_changed",
      targetType: "session",
      targetId: c.id,
      summary: `회차 상태를 'closed' 로 변경 — ${note}`,
      detail: { status: "closed", reason: "group_booking_closure" },
    });
    closed.push(name);
  }
  return { closed, kept };
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
