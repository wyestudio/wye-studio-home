import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 방탈출 현장 앱(wye-studio-webapp)이 보드판 사진을 올리는 자리.
 *
 * 왜 여기로 오는가: 현장 서버는 매장 와이파이 안에만 있어서, 거기 올린 파일은
 * 같은 와이파이에 붙은 기기만 볼 수 있다. 참가자가 LTE 로도 열 수 있으려면
 * 인터넷에 공개된 주소가 있어야 하고, 그게 이 프로젝트의 Supabase Storage 다.
 *
 * ⚠️ service_role 키는 **이 서버에만** 둔다. 현장 노트북은 행사 때 여러 사람이 만지는
 *    기기라 예약·결제 DB 까지 열 수 있는 키를 두지 않는다. 현장은 아래 공유 비밀번호
 *    하나만 갖고, 그 키로 할 수 있는 일은 이 버킷에 이미지를 올리는 것뿐이다.
 */

const BUCKET = "board-photos";
const MAX_BYTES = 8 * 1024 * 1024; // 보드 사진 한 장은 보통 0.5~2MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(request: NextRequest) {
  const expected = process.env.BOARD_PHOTO_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: "BOARD_PHOTO_SECRET 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (request.headers.get("x-board-secret") !== expected) {
    return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "폼 데이터를 읽지 못했습니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "8MB 이하만 올릴 수 있습니다." }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "PNG · JPG · WEBP 만 올릴 수 있습니다." }, { status: 415 });
  }

  // 파일명은 날짜 폴더 + 임의값. 임의값이 있어야 주소를 몰래 훑어 남의 사진을 찾을 수 없다
  // (버킷은 공개라 주소를 아는 사람은 누구나 열 수 있다 — 그래서 주소를 못 짐작하게 만든다).
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const key = `${day}/${Date.now()}-${crypto.randomUUID()}.${EXT[file.type]}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) {
    return NextResponse.json({ ok: false, error: `업로드 실패: ${error.message}` }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return NextResponse.json({ ok: true, url: data.publicUrl, key });
}
