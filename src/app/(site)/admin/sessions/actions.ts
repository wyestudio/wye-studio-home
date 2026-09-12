"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { defaultMinAge } from "@/types/catalog";
import {
  addDays,
  computeOpensAt,
  kstToUtcIso,
  scheduledDates,
  todayKst,
} from "@/lib/scheduleRules";

export type ScheduleInput = {
  theme_id: string;
  /** 시작일 (KST, YYYY-MM-DD) */
  start_date: string;
  /** 종료일 (KST, YYYY-MM-DD). 비우면 무기한 반복 */
  end_date: string | null;
  /** 반복 요일 (0=일 … 6=토) */
  weekdays: number[];
  /** 하루 회차 시각 (KST, HH:MM) */
  times: string[];
  /** 회차일로부터 N주 전에 연다 */
  open_weeks_before: number;
  /** 공개를 고정할 요일 (0=일 … 6=토). null 이면 회차마다 정확히 N주 전 */
  open_weekday: number | null;
  /** 그 날 몇 시 (KST, HH:MM) */
  open_time: string;
};

/** 한 번에 만들어 둘 기간. 지나면 어드민에서 다시 저장해 늘린다. */
const HORIZON_WEEKS = 26;
const MAX_CREATE = 800;

function validateSchedule(input: ScheduleInput): string | null {
  if (!input.theme_id) return "테마를 선택해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start_date)) return "시작일을 입력해주세요.";
  if (input.end_date && input.end_date < input.start_date) return "종료일은 시작일보다 빠를 수 없습니다.";
  if (input.weekdays.length === 0) return "반복 요일을 최소 하나 선택해주세요.";
  if (input.times.filter(Boolean).length === 0) return "회차 시각을 최소 1개 입력해주세요.";
  if (!Number.isInteger(input.open_weeks_before) || input.open_weeks_before < 0 || input.open_weeks_before > 52)
    return "공개 주기는 0~52주 사이여야 합니다.";
  if (!/^\d{2}:\d{2}$/.test(input.open_time)) return "공개 시각을 입력해주세요.";
  return null;
}

/**
 * 편성을 저장하고 그에 맞는 회차를 만들어 둔다.
 *
 * ⚠️ 공개 여부를 나중에 크론으로 바꾸지 않는다. 회차마다 opens_at 을 미리 박아두면
 *    시간이 지나는 것만으로 열린다 — 실행이 밀려서 안 열리는 일이 없다.
 * ⚠️ 이미 있는 회차는 건드리지 않는다. 신청이 붙어 있을 수 있다.
 */
export async function saveSchedule(input: ScheduleInput): Promise<ActionResult> {
  try {
    const invalid = validateSchedule(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();

    const { data: theme, error: themeErr } = await supabase
      .from("themes")
      .select("id, duration_minutes, min_age_floor")
      .eq("id", input.theme_id)
      .single();
    if (themeErr || !theme) return { error: "테마를 찾을 수 없습니다." };

    const times = input.times.filter(Boolean);
    const rule = {
      start_date: input.start_date,
      end_date: input.end_date,
      weekdays: input.weekdays,
      times,
      open_weeks_before: input.open_weeks_before,
      open_weekday: input.open_weekday,
      open_time: input.open_time,
    };

    const today = todayKst();
    const until = addDays(today, 7 * HORIZON_WEEKS);
    // 과거 날짜는 만들지 않는다. 편성 시작일이 미래면 거기서부터.
    const dates = scheduledDates(rule, today, until);

    const rows = dates.flatMap((ymd) =>
      times.map((t) => {
        const startIso = kstToUtcIso(ymd, t);
        return {
          theme_id: input.theme_id,
          start_at: startIso,
          end_at: new Date(new Date(startIso).getTime() + theme.duration_minutes * 60_000).toISOString(),
          status: "open" as const,
          min_age: defaultMinAge(t, theme.duration_minutes, theme.min_age_floor),
          opens_at: computeOpensAt(ymd, rule),
        };
      })
    );

    if (rows.length > MAX_CREATE) {
      return { error: `만들 회차가 ${rows.length}개로 너무 많습니다. 요일·시각을 줄여주세요.` };
    }

    const { error: schedErr } = await supabase.from("theme_schedules").upsert(
      {
        theme_id: input.theme_id,
        start_date: input.start_date,
        end_date: input.end_date,
        weekdays: input.weekdays,
        times,
        open_weeks_before: input.open_weeks_before,
        open_weekday: input.open_weekday,
        open_time: input.open_time,
        generated_until: input.end_date && input.end_date < until ? input.end_date : until,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "theme_id" }
    );
    if (schedErr) throw schedErr;

    let created = 0;
    if (rows.length > 0) {
      const { data: existing } = await supabase
        .from("sessions")
        .select("start_at")
        .eq("theme_id", input.theme_id)
        .gte("start_at", rows[0].start_at);

      const taken = new Set(
        (existing ?? []).map((e) => new Date(e.start_at as string).toISOString())
      );
      const fresh = rows.filter((r) => !taken.has(r.start_at));

      if (fresh.length > 0) {
        const { error } = await supabase.from("sessions").insert(fresh);
        if (error) throw error;
        created = fresh.length;
      }
    }

    await writeAuditLog({
      action: "schedule.saved",
      targetType: "schedule",
      targetId: input.theme_id,
      summary: `회차 편성 저장 — 새 회차 ${created}개 생성 (${until}까지)`,
      detail: { ...rule, created, until },
    });

    revalidatePath("/admin/sessions");
    revalidatePath("/admin");

    return {
      success: true as const,
      message:
        created > 0
          ? `편성을 저장하고 회차 ${created}개를 만들었습니다. (${until}까지)`
          : `편성을 저장했습니다. 새로 만들 회차는 없습니다. (${until}까지 이미 생성됨)`,
    };
  } catch (err) {
    return toActionError(err, "편성 저장 실패");
  }
}

export async function updateSessionStatus(id: string, status: "open" | "closed"): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("sessions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "session.status_changed",
      targetType: "session",
      targetId: id,
      summary: `회차 상태를 '${status}' 로 변경`,
      detail: { status },
    });

    revalidatePath("/admin/sessions");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "회차 상태 변경 실패");
  }
}

export async function updateSessionMinAge(id: string, minAge: number): Promise<ActionResult> {
  try {
    if (!Number.isInteger(minAge) || minAge < 0 || minAge > 100) {
      return { error: "최소 연령이 올바르지 않습니다." };
    }
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("sessions")
      .update({ min_age: minAge, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await writeAuditLog({
      action: "session.min_age_changed",
      targetType: "session",
      targetId: id,
      summary: `회차 최소 연령을 만 ${minAge}세로 변경`,
      detail: { min_age: minAge },
    });

    revalidatePath("/admin/sessions");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "최소 연령 변경 실패");
  }
}

export async function deleteSession(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    // 신청이 하나라도 있으면 삭제하지 않는다. 고객 이력이 사라지면 안 된다.
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("session_id", id);

    if (count && count > 0) {
      return {
        error: `이 회차에 신청이 ${count}건 있어 삭제할 수 없습니다. 진행을 취소하려면 '마감' 또는 회차 비활성화를 쓰세요.`,
      };
    }

    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (!error) {
      await writeAuditLog({
        action: "session.deleted",
        targetType: "session",
        targetId: id,
        summary: "회차 삭제 (신청 0건)",
      });
    }
    if (error) throw error;

    revalidatePath("/admin/sessions");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "회차 삭제 실패");
  }
}
