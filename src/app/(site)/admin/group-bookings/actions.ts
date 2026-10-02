"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { isInquiryStatus, inquiryStatusLabel } from "@/lib/groupBooking";

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
