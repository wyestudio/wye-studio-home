"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, toActionError, type ActionResult } from "@/lib/adminGuard";
import { writeAuditLog } from "@/lib/auditLog";
import { THEMES_TAG } from "@/lib/themes";

export type VenueInput = {
  id?: string;
  name: string;
  address: string;
  area_label: string;
  parking_note: string;
  map_url: string;
  /** '37.54, 127.08' 처럼 위도·경도를 한 칸에. 비우면 지도 없음. */
  coords: string;
  is_active: boolean;
};

/** 좌표 칸을 읽는다. 비었으면 null, 형식이 틀리면 에러 문구. */
function parseCoords(raw: string): { lat: number; lng: number } | null | string {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    return "좌표는 '위도, 경도' 형식으로 입력해주세요. 예: 37.5403064, 127.0851419";
  }
  const [lat, lng] = parts;
  // 순서를 바꿔 넣는 실수가 제일 흔하다. 한국 범위를 벗어나면 막는다.
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return "좌표가 한국 범위를 벗어났습니다. 위도(33~39)를 앞에, 경도(124~132)를 뒤에 적어주세요.";
  }
  return { lat, lng };
}

function validate(input: VenueInput): string | null {
  if (!input.name.trim()) return "상호명을 입력해주세요.";
  if (!input.address.trim()) return "정확 주소를 입력해주세요.";
  if (!input.area_label.trim()) return "대략 위치를 입력해주세요.";
  const coords = parseCoords(input.coords);
  if (typeof coords === "string") return coords;
  return null;
}

export async function saveVenue(input: VenueInput): Promise<ActionResult> {
  try {
    const invalid = validate(input);
    if (invalid) return { error: invalid };

    const supabase = await requireAdmin();
    // validate 를 통과했으니 여기선 null 아니면 좌표다.
    const coords = parseCoords(input.coords) as { lat: number; lng: number } | null;
    const row = {
      name: input.name.trim(),
      address: input.address.trim(),
      area_label: input.area_label.trim(),
      parking_note: input.parking_note.trim() || null,
      map_url: input.map_url.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    };

    // 감사로그에 남길 대상 id 가 필요해 insert 시 id 를 돌려받는다.
    let venueId = input.id ?? "";
    if (input.id) {
      const { error } = await supabase.from("venues").update(row).eq("id", input.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("venues").insert(row).select("id").single();
      if (error) throw error;
      venueId = data.id as string;
    }

    await writeAuditLog({
      action: "venue.saved",
      targetType: "venue",
      targetId: venueId,
      summary: `장소 저장 — ${input.name}`,
    });

    revalidatePath("/admin/venues");
    // 테마 상세 '진행 장소' 블록이 장소 정보를 캐시해 둔다(src/lib/themes.ts).
    // 주소·지도 링크를 고치고 바로 확인할 수 있게 털어준다 (themes/actions.ts 와 같은 이유).
    updateTag(THEMES_TAG);
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

    await writeAuditLog({
      action: "venue.deleted",
      targetType: "venue",
      targetId: id,
      summary: "장소 삭제",
    });

    revalidatePath("/admin/venues");
    return { success: true as const };
  } catch (err) {
    return toActionError(err, "장소 삭제 실패");
  }
}
