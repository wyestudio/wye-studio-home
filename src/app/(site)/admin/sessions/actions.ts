"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { defaultMinAge } from "@/types/catalog";

/**
 * KST 기준 "YYYY-MM-DD" + "HH:MM" 을 UTC ISO 문자열로 바꾼다.
 *
 * ⚠️ 서버(Vercel)는 UTC 로 돌기 때문에 new Date("2026-09-26T11:30") 처럼 쓰면
 *    KST 가 아니라 UTC 로 해석돼 9시간이 어긋난다. 오프셋을 명시한다.
 *    한국은 서머타임이 없어 +09:00 고정이 안전하다.
 */
function kstToUtcIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** KST 기준 요일 (0=일 … 6=토) */
function kstWeekday(d: Date): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(d);
  return WEEKDAY_INDEX[short] ?? -1;
}

export type SessionCreateInput = {
  theme_id: string;
  /** 시작일 (KST, YYYY-MM-DD) */
  start_date: string;
  /** 하루에 열 회차 시각들 (KST, HH:MM) */
  times: string[];
  /** 반복할 요일 (0=일 … 6=토). 비우면 start_date 하루만 생성 */
  weekdays: number[];
  /** 반복 주 수 (1 = 그 주만) */
  weeks: number;
  admin_note: string;
};

const MAX_CREATE = 200;

export async function createSessions(input: SessionCreateInput): Promise<ActionResult> {
  try {
    if (!input.theme_id) return { error: "테마를 선택해주세요." };
    if (!input.start_date) return { error: "시작일을 입력해주세요." };
    if (input.times.length === 0) return { error: "회차 시각을 최소 1개 입력해주세요." };
    if (input.weeks < 1) return { error: "반복 주 수는 1 이상이어야 합니다." };

    const supabase = await requireAdmin();

    const { data: theme, error: themeErr } = await supabase
      .from("themes")
      .select("id, duration_minutes, min_age_floor")
      .eq("id", input.theme_id)
      .single();
    if (themeErr || !theme) return { error: "테마를 찾을 수 없습니다." };

    // ── 생성할 날짜 목록 계산 ──────────────────────────────────
    const dates: string[] = [];
    const start = new Date(`${input.start_date}T00:00:00+09:00`);

    if (input.weekdays.length === 0) {
      dates.push(input.start_date);
    } else {
      for (let w = 0; w < input.weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const cur = new Date(start);
          cur.setUTCDate(cur.getUTCDate() + w * 7 + d);
          // KST 기준 요일로 판정한다. 서버가 UTC 라 UTC 요일과 다를 수 있다.
          if (!input.weekdays.includes(kstWeekday(cur))) continue;

          const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(cur);
          if (ymd < input.start_date) continue;
          if (!dates.includes(ymd)) dates.push(ymd);
        }
      }
    }

    const rows = dates
      .sort()
      .flatMap((ymd) =>
        input.times.map((t) => {
          const startIso = kstToUtcIso(ymd, t);
          const endIso = new Date(
            new Date(startIso).getTime() + theme.duration_minutes * 60_000
          ).toISOString();
          const hour = Number(t.split(":")[0]);
          return {
            theme_id: input.theme_id,
            start_at: startIso,
            end_at: endIso,
            status: "open" as const,
            min_age: defaultMinAge(hour, theme.min_age_floor),
            admin_note: input.admin_note.trim() || null,
          };
        })
      );

    if (rows.length === 0) return { error: "생성할 회차가 없습니다. 요일·기간을 확인해주세요." };
    if (rows.length > MAX_CREATE) {
      return { error: `한 번에 ${MAX_CREATE}개까지만 만들 수 있습니다 (요청 ${rows.length}개).` };
    }

    // 같은 테마·같은 시각이 이미 있으면 건너뛴다(unique 제약이 없으므로 앱에서 확인).
    const { data: existing } = await supabase
      .from("sessions")
      .select("start_at")
      .eq("theme_id", input.theme_id)
      .in("start_at", rows.map((r) => r.start_at));

    const taken = new Set((existing ?? []).map((e) => new Date(e.start_at as string).toISOString()));
    const fresh = rows.filter((r) => !taken.has(r.start_at));

    if (fresh.length === 0) {
      return { error: "요청한 회차가 이미 전부 등록돼 있습니다." };
    }

    const { error } = await supabase.from("sessions").insert(fresh);
    if (error) throw error;

    revalidatePath("/admin/sessions");
    revalidatePath("/admin");

    const skipped = rows.length - fresh.length;
    return {
      success: true as const,
      message: `회차 ${fresh.length}개를 만들었습니다.${skipped > 0 ? ` (이미 있던 ${skipped}개는 건너뜀)` : ""}`,
    };
  } catch (err) {
    return toActionError(err, "회차 생성 실패");
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
    if (error) throw error;

    revalidatePath("/admin/sessions");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "회차 삭제 실패");
  }
}
