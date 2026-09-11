"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";

export type VenueInput = {
  id?: string;
  name: string;
  address: string;
  area_label: string;
  parking_note: string;
  map_url: string;
  is_active: boolean;
};

function validate(input: VenueInput): string | null {
  if (!input.name.trim()) return "상호명을 입력해주세요.";
  if (!input.address.trim()) return "정확 주소를 입력해주세요.";
  if (!input.area_label.trim()) return "공개용 위치를 입력해주세요.";
  return null;
}

export async function saveVenue(input: VenueInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();
    const row = {
      name: input.name.trim(),
      address: input.address.trim(),
      area_label: input.area_label.trim(),
      parking_note: input.parking_note.trim() || null,
      map_url: input.map_url.trim() || null,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await supabase.from("venues").update(row).eq("id", input.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("venues").insert(row);
      if (error) throw error;
    }

    revalidatePath("/admin/venues");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "장소 저장 실패");
  }
}

export async function deleteVenue(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();

    // 테마가 참조 중이면 FK 로 막히지만, 먼저 확인해 친절한 메시지를 준다.
    const { count } = await supabase
      .from("themes")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", id);

    if (count && count > 0) {
      return { error: `이 장소를 쓰는 테마가 ${count}개 있어 삭제할 수 없습니다. 먼저 테마의 장소를 바꿔주세요.` };
    }

    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/venues");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "장소 삭제 실패");
  }
}
