import { getPopupForPage } from "@/lib/popups";
import type { PopupPage } from "@/types/popup";
import { SitePopup } from "./SitePopup";

/**
 * 팝업을 띄울 화면에 한 줄로 끼워 넣는 서버 컴포넌트.
 *
 * ⚠️ 루트 레이아웃에 두지 않는다. 레이아웃에 두면 신청 폼·참여내역 조회처럼
 *    **작업 중인 화면**에서도 팝업이 끼어든다. 어느 화면에 띄울지는 운영자가
 *    팝업마다 고르는 값(popups.pages)이고, 그 화면들만 이 컴포넌트를 부른다.
 */
export async function SitePopupMount({ page }: { page: PopupPage }) {
  const popup = await getPopupForPage(page);
  if (!popup) return null;
  return <SitePopup popup={popup} />;
}
