"use server";

import { requireAdmin } from "@/lib/adminGuard";

/**
 * 어드민 이미지 업로드 (테마 포스터 · 접속 팝업).
 *
 * 예전에는 hero_image_path 에 '/bar-o-title.png' 같은 경로를 손으로 적었다.
 * 새 포스터를 올리려면 개발자가 public/ 에 파일을 넣고 배포해야 했다.
 *
 * ⚠️ 파일은 service_role 로 올린다. anon 에 쓰기를 열면 누구나 우리 저장소에
 *    파일을 쌓을 수 있다.
 */

const BUCKET = "theme-assets";
/**
 * 올릴 수 있는 폴더. 화이트리스트로 둔다 — 폴더명을 그대로 받으면
 * '../' 같은 값으로 버킷의 다른 자리에 쓸 수 있다.
 */
const FOLDERS = ["themes", "popups"] as const;
type Folder = (typeof FOLDERS)[number];
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
    // 폴더를 안 보내면 예전처럼 themes/ 로 간다(기존 호출부를 안 고쳐도 되게).
    const raw = String(formData.get("folder") ?? "themes");
    const folder: Folder = (FOLDERS as readonly string[]).includes(raw) ? (raw as Folder) : "themes";
    const key = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

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
