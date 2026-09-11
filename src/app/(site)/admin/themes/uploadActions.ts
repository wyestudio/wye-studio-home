"use server";

import { requireAdmin } from "@/lib/adminGuard";

/**
 * 테마 포스터 업로드.
 *
 * 예전에는 hero_image_path 에 '/bar-o-title.png' 같은 경로를 손으로 적었다.
 * 새 포스터를 올리려면 개발자가 public/ 에 파일을 넣고 배포해야 했다.
 *
 * ⚠️ 파일은 service_role 로 올린다. anon 에 쓰기를 열면 누구나 우리 저장소에
 *    파일을 쌓을 수 있다.
 */

const BUCKET = "theme-assets";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadThemeImage(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "파일을 선택해주세요." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: "5MB 이하 이미지만 올릴 수 있어요." };
    }
    if (!ALLOWED.includes(file.type)) {
      return { ok: false, error: "JPG · PNG · WEBP · GIF 만 올릴 수 있어요." };
    }

    const supabase = await requireAdmin();

    // 파일명은 그대로 쓰지 않는다. 한글·공백·중복이 섞이면 URL 이 깨진다.
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `themes/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "업로드 실패" };
  }
}
