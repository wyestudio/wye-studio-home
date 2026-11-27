import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";
import { ADMIN_THEME_COOKIE, parseAdminTheme } from "@/components/admin/adminTheme";
import "./admin.css";

export const dynamic = "force-dynamic";

/**
 * 어드민 껍데기 — 관리자 전용 틀(왼쪽 메뉴 + 본문)과 관리자 색(admin.css).
 *
 * admin-shell 클래스가 관리자 범위의 표시다. admin.css 가 이 클래스를 보고 색을 바꾸고,
 * data-admin-theme 로 라이트(기본) / 다크를 가른다. 모드는 기기별 쿠키에서 읽는다 —
 * 서버가 첫 화면부터 고른 모드로 그려야 번쩍임이 없다.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value);
  return (
    <div className="admin-shell" data-admin-theme={theme}>
      <AdminShell theme={theme}>{children}</AdminShell>
    </div>
  );
}
