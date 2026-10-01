/**
 * 접속 팝업의 타입과 화면 이름.
 *
 * ⚠️ 데이터를 읽는 쪽(src/lib/popups.ts)과 **갈라 둔다.** 그쪽은
 *    `import "server-only"` 라서, 어드민 편집기 같은 클라이언트 컴포넌트가
 *    라벨 하나 쓰겠다고 import 하면 빌드가 깨진다(실제로 깨졌다).
 */

/** 팝업을 띄울 화면. DB 의 popups.pages 체크 제약과 같은 값이어야 한다. */
export type PopupPage = "home" | "themes" | "theme_detail";

export const POPUP_PAGE_LABELS: Record<PopupPage, string> = {
  home: "홈",
  themes: "테마 목록",
  theme_detail: "테마 상세",
};

/** public_popup 뷰가 내보내는 모양. 게시 기간은 뷰가 이미 걸러 준 상태다. */
export type Popup = {
  id: string;
  image_url: string | null;
  image_alt: string | null;
  body: string | null;
  link_url: string | null;
  link_label: string | null;
  pages: PopupPage[];
  sort: number;
};
