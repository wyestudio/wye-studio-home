import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "@/lib/auditLog";
import { GROUP_BOOKING_THEME_SLUGS } from "@/lib/groupBooking";
import { BASE_MINUTES, CLOSURE_BUFFER_MINUTES, addMinutes } from "@/lib/groupPricing";
import { kstToUtcIso } from "@/lib/scheduleRules";

/**
 * 단체 일정을 막을 때 같이 하는 일 — 겹치는 빈 회차 닫기.
 *
 * 원래 group-bookings/actions.ts 안에 있던 것을 **한 글자도 고치지 않고** 옮겼다(2026-11-27 관리자 개편).
 * 예전 「예약 확정」 과 새 「입금 확인」(groupActions.ts)이 같은 함수를 써야 동작이 갈리지 않는다.
 * ("use server" 파일에서 export 하면 누구나 부를 수 있는 서버 액션이 되므로 거기 둘 수 없다.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

/** '2026-11-01 15:30~18:30' · '2026-11-01 종일'. 감사 기록과 회차 메모에 남는다. */
export function closureLabel(date: string, time: string | null, minutes: number | null): string {
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
export async function closeOverlappingSessions(
  supabase: AdminClient,
  date: string,
  time: string | null,
  minutes: number | null,
  label: string
): Promise<{ closed: string[]; kept: string[] }> {
  // 시간 구간이면 앞뒤 세팅 · 정리 시간까지 닫는다 — 고객 화면이 막는 구간(closureSlots)과 같다.
  const buffer = CLOSURE_BUFFER_MINUTES * 60_000;
  const start = kstToUtcIso(date, time ?? "00:00");
  const from = time ? new Date(new Date(start).getTime() - buffer).toISOString() : start;
  const to = time
    ? new Date(new Date(start).getTime() + (minutes ?? BASE_MINUTES) * 60_000 + buffer).toISOString()
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

