/**
 * 관리자 라이트 / 다크 모드 — 서버(admin/layout.tsx · (site)/layout.tsx)와 화면(AdminShell)이 같이 읽는 값.
 * ⚠️ "use client" 파일에 두지 않는다 — 서버 컴포넌트가 클라이언트 모듈의 상수를 읽을 수 없다.
 */
export type AdminTheme = "light" | "dark";

/** 모드를 기억하는 쿠키(기기별). 값이 "dark" 가 아니면 라이트다. */
export const ADMIN_THEME_COOKIE = "wye_admin_theme";

/** 휴대폰 주소창 둘레 색 — admin.css 의 --background 와 같은 값이어야 이어져 보인다. */
export const ADMIN_THEME_COLOR: Record<AdminTheme, string> = { light: "#f5f6f8", dark: "#04070d" };

export function parseAdminTheme(value: string | undefined): AdminTheme {
  return value === "dark" ? "dark" : "light";
}
