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

type ImageType = "image/png" | "image/jpeg" | "image/webp";
const EXT: Record<ImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * 파일 앞머리(매직 바이트)로 진짜 형식을 가린다.
 *
 * ⚠️ `file.type` 을 믿으면 안 된다. 올리는 쪽이 적어 보낸 **글자**일 뿐이고,
 *    Supabase 의 allowed_mime_types 도 같은 글자를 볼 뿐이다. 비밀번호를 아는 쪽은
 *    아무 바이트나 `image/png` 라고 적어 우리 공개 저장소에 올릴 수 있었다.
 * ⚠️ 현장 중계 서버도 같은 검사를 한다. 그래도 여기서 또 보는 이유는, 이 주소가
 *    중계를 거치지 않고 비밀번호만 알면 바로 칠 수 있는 자리이기 때문이다.
 */
function sniff(head: Uint8Array): ImageType | null {
  // PNG 는 8바이트 서명을 다 본다 — 어차피 읽어 둔 바이트라 비용이 같다.
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (head.length >= 8 && PNG.every((b, i) => head[i] === b)) return "image/png";
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  const ascii = (a: number, b: number) => String.fromCharCode(...head.slice(a, b));
  if (head.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

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
  // 적어 보낸 글자가 아니라 **앞머리를 직접 보고** 판별한 형식을 쓴다.
  const type = sniff(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!type) {
    return NextResponse.json(
      { ok: false, error: "이미지 파일이 아닙니다. PNG · JPG · WEBP 만 올릴 수 있습니다." },
      { status: 415 }
    );
  }

  // 파일명은 날짜 폴더 + 임의값. 임의값이 있어야 주소를 몰래 훑어 남의 사진을 찾을 수 없다
  // (버킷은 공개라 주소를 아는 사람은 누구나 열 수 있다 — 그래서 주소를 못 짐작하게 만든다).
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const key = `${day}/${Date.now()}-${crypto.randomUUID()}.${EXT[type]}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType: type, upsert: false, cacheControl: "31536000" });
  if (error) {
    return NextResponse.json({ ok: false, error: `업로드 실패: ${error.message}` }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return NextResponse.json({ ok: true, url: data.publicUrl, key });
}
