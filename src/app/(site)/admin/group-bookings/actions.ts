"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { isInquiryStatus, inquiryStatusLabel } from "@/lib/groupBooking";
import { GROUP_CLOSURES_TAG } from "@/lib/groupClosures";
import { HHMM, ISO_DATE } from "@/lib/groupPricing";

/**
 * 단체 예약 문의의 진행 상태·메모 저장.
 *
 * 금액이 바뀌는 작업이 아니다(견적은 사람이 따로 안내한다) — 여기 값은 **어디까지
 * 응대했는지** 를 적는 운영 메모다. 그래도 누가 언제 바꿨는지는 남긴다. 접수함을
 * 둘이 나눠 보면 "이거 연락했나" 가 반드시 겹친다.
 */
export async function saveInquiryStatus(input: {
  id: string;
  status: string;
  memo: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    if (!isInquiryStatus(input.status)) {
      return { error: "알 수 없는 상태입니다." };
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

    revalidatePath("/admin/group-bookings");
    return { success: true, message: "저장했습니다." };
  } catch (err) {
    return toActionError(err, "저장에 실패했습니다.");
  }
}

/**
 * 단체 견적 화면에서 고를 수 없게 날짜·회차를 막는다.
 *
 * 단체 일정 데이터가 따로 없어서 견적은 '희망 일시' 로 받는다. 다른 단체가 입금해
 * 확정된 날처럼 이미 찬 일정만 여기서 막는다(2026-10-25 대표님). time 이 null 이면 종일.
 * ⚠️ 막는 순간 고객 화면(캐시 60초 안)과 접수 함수 양쪽에 걸린다.
 */
export async function addGroupClosure(input: {
  date: string;
  time: string | null;
  note: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (!ISO_DATE.test(input.date)) return { error: "날짜를 확인해주세요." };
    if (input.time !== null && !HHMM.test(input.time)) return { error: "시간을 확인해주세요." };

    const { data, error } = await supabase
      .from("group_booking_closures")
      .insert({ date: input.date, start_time: input.time, note: input.note.trim() || null })
      .select("id")
      .single();
    if (error) {
      // 같은 날짜·회차를 두 번 막으면 유니크 인덱스에 걸린다.
      if (error.code === "23505") return { error: "이미 마감으로 표시된 일정입니다." };
      return { error: error.message };
    }

    const label = `${input.date} ${input.time ?? "종일"}`;
    await writeAuditLog({
      action: "group_booking.closure_added",
      targetType: "group_booking_closure",
      targetId: (data as { id: string }).id,
      summary: `단체 일정 마감 ${label}`,
      detail: { date: input.date, time: input.time },
    });

    updateTag(GROUP_CLOSURES_TAG);
    revalidatePath("/admin/group-bookings");
    return { success: true, message: `${label} 을 마감으로 표시했습니다.` };
  } catch (err) {
    return toActionError(err, "마감 표시에 실패했습니다.");
  }
}

export async function removeGroupClosure(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase
      .from("group_booking_closures")
      .delete()
      .eq("id", id)
      .select("date, start_time")
      .single();
    if (error) return { error: error.message };

    const row = data as { date: string; start_time: string | null };
    const label = `${row.date} ${row.start_time ?? "종일"}`;
    await writeAuditLog({
      action: "group_booking.closure_removed",
      targetType: "group_booking_closure",
      targetId: id,
      summary: `단체 일정 마감 해제 ${label}`,
      detail: { date: row.date, time: row.start_time },
    });

    updateTag(GROUP_CLOSURES_TAG);
    revalidatePath("/admin/group-bookings");
    return { success: true, message: `${label} 마감을 풀었습니다.` };
  } catch (err) {
    return toActionError(err, "마감 해제에 실패했습니다.");
  }
}
