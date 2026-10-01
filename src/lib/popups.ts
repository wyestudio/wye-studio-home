import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Popup, PopupPage } from "@/types/popup";

/**
 * 접속 시 뜨는 안내 팝업 (읽기).
 *
 * 게시 기간 판정은 **DB 뷰(public_popup)가 끝낸 상태로** 내려온다. 화면이
 * 기간을 다시 보면 브라우저 시계가 틀어진 기기에서 이미 끝난 팝업이 뜬다.
 *
 * ⚠️ 타입·라벨은 여기가 아니라 src/types/popup.ts 에 있다 — 이 파일은
 *    server-only 라서 클라이언트 컴포넌트가 import 하면 빌드가 깨진다.
 */
export const POPUPS_TAG = "popups";

async function _getPopups(): Promise<Popup[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("public_popup")
    .select("*")
    .order("sort")
    .order("id");
  // 읽기 실패로 화면이 깨지면 안 된다. 팝업만 안 뜬다.
  if (error || !data) return [];
  return data as Popup[];
}

/** 30초. 어드민에서 켠 직후 확인하는 값이라 길게 잡으면 "안 뜨는데?" 가 된다. */
export const getPopups = unstable_cache(_getPopups, ["popups"], {
  revalidate: 30,
  tags: [POPUPS_TAG],
});

/** 이 화면에서 띄울 팝업만. 여러 개면 가장 앞선 것 하나만 쓴다 — 겹쳐 뜨면 못 닫는다. */
export async function getPopupForPage(page: PopupPage): Promise<Popup | null> {
  const all = await getPopups();
  return all.find((p) => p.pages.includes(page)) ?? null;
}
