"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Chevron } from "@/components/ui/Chevron";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { ADMIN_THEME_COOKIE, type AdminTheme } from "@/components/admin/adminTheme";
import {
  ADMIN_HOME,
  ADMIN_MENU,
  activeAdminGroup,
  activeAdminLabel,
  isAdminMenuActive,
} from "@/components/admin/adminMenu";

/**
 * 관리자 전용 틀 — 왼쪽 메뉴 + 본문(2026-11-27 대표님).
 *
 * 예전에는 고객 사이트의 머리(Header) · 바닥(Footer) · 별 배경 안에 관리자 화면을 그렸다.
 * 이제 관리자 호스트에서는 그것들을 빼고((site)/layout.tsx) 이 틀만 쓴다.
 *
 * 화면 폭
 *   md 이상  왼쪽에 메뉴가 늘 보인다(스크롤해도 붙어 있다)
 *   md 미만  메뉴를 접는다. 머리 줄의 버튼을 누르면 왼쪽에서 서랍으로 나온다
 *            — 운영자는 행사 현장에서 휴대폰으로도 본다
 *
 * ⚠️ 이 틀은 **껍데기**만 그린다. 본문(children)의 기능 · 주소 · 서버 코드는 건드리지 않는다.
 * ⚠️ <header> 태그를 쓰지 않는다 — globals.css 의 `body:has(.admin-shell) header` 규칙이 걸린다.
 * ⚠️ 로그인 화면(/login)에는 메뉴를 그리지 않는다 — 로그인 전에 메뉴가 보이면 안 된다.
 */
export function AdminShell({ theme: initialTheme, children }: { theme: AdminTheme; children: React.ReactNode }) {
  const pathname = usePathname();

  const [theme, setTheme] = useState<AdminTheme>(initialTheme);
  function changeTheme(next: AdminTheme) {
    setTheme(next);
    document.querySelectorAll(".admin-shell").forEach((el) => el.setAttribute("data-admin-theme", next));
    // 1년. 관리자 호스트 전체에서 읽히게 path=/ 로 둔다.
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  const isLogin = /(^|\/)login\/?$/.test(pathname);

  // 서랍은 '어느 주소에서 열었는지' 로 기억한다 — 메뉴를 눌러 주소가 바뀌면 저절로 닫힌다.
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawerOpen = drawerAt === pathname;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerAt(null);
    };
    document.addEventListener("keydown", onKey);
    // 서랍이 열린 동안 뒤 화면이 같이 스크롤되지 않게 한다.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  if (isLogin) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* 휴대폰 머리 줄 */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerAt(drawerOpen ? null : pathname)}
          aria-label="메뉴"
          aria-expanded={drawerOpen}
          aria-controls="admin-menu-drawer"
          // 막대는 작지만 누르는 영역은 44×44 다(손가락 기준 최소 크기)
          className="-ml-2 flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="h-0.5 w-5 bg-foreground" />
          <span className="h-0.5 w-5 bg-foreground" />
          <span className="h-0.5 w-5 bg-foreground" />
        </button>
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
          {activeAdminLabel(pathname) ?? "관리자"}
        </span>
        <AdminLogo className="h-8 w-auto" />
      </div>

      {/* 컴퓨터: 늘 보이는 왼쪽 메뉴 */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface md:flex">
        <AdminMenu pathname={pathname} theme={theme} onTheme={changeTheme} />
      </aside>

      {/* 휴대폰: 서랍 */}
      {drawerOpen && (
        // z-50 — 테스트 환경 띠(TestEnvBanner, z-50)보다 뒤에 그려지면 서랍 윗부분(로고)이 띠에 가린다.
        // 같은 값이면 문서에서 뒤에 오는 쪽이 위다.
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setDrawerAt(null)}
            className="absolute inset-0 bg-black/50"
          />
          <aside
            id="admin-menu-drawer"
            className="absolute inset-y-0 left-0 flex w-72 max-w-full flex-col overflow-y-auto border-r border-border bg-surface"
          >
            <AdminMenu pathname={pathname} theme={theme} onTheme={changeTheme} />
          </aside>
        </div>
      )}

      {/* 본문. min-w-0 이 없으면 넓은 표가 화면을 옆으로 밀어낸다 */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function AdminLogo({ className }: { className: string }) {
  return (
    <>
      <Image src="/logo-black.png" alt="" width={860} height={600} className={`admin-logo-light ${className}`} />
      <Image src="/logo-white.png" alt="" width={859} height={600} className={`admin-logo-dark ${className}`} />
    </>
  );
}

function AdminMenu({
  pathname,
  theme,
  onTheme,
}: {
  pathname: string;
  theme: AdminTheme;
  onTheme: (next: AdminTheme) => void;
}) {
  const current = activeAdminGroup(pathname);
  // 펼친 대분류도 '어느 주소에서 골랐는지' 와 함께 기억한다 — 다른 화면으로 가면 그 화면의 대분류가 다시 펼쳐진다.
  const [picked, setPicked] = useState<{ at: string; label: string | null } | null>(null);
  const open = picked && picked.at === pathname ? picked.label : current;

  const itemClass = (active: boolean) =>
    `flex min-h-11 items-center rounded-lg px-3 text-body-sm transition-colors ${
      active ? "bg-brand-soft font-semibold text-brand" : "text-foreground hover:bg-fill"
    }`;

  return (
    <nav aria-label="관리자 메뉴" className="flex flex-1 flex-col gap-1 p-3">
      <Link href="/" className="mb-2 flex items-center gap-2 px-3 py-3">
        <AdminLogo className="h-10 w-auto" />
        <span className="text-body font-extrabold text-foreground">관리자</span>
      </Link>

      <Link
        href={ADMIN_HOME.href}
        aria-current={isAdminMenuActive(pathname, ADMIN_HOME.href) ? "page" : undefined}
        className={itemClass(isAdminMenuActive(pathname, ADMIN_HOME.href))}
      >
        {ADMIN_HOME.label}
      </Link>

      {ADMIN_MENU.map((group) => {
        const isOpen = open === group.label;
        const panelId = `admin-menu-${group.label}`;
        return (
          <div key={group.label}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setPicked({ at: pathname, label: isOpen ? null : group.label })}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-body-sm transition-colors hover:bg-fill ${
                current === group.label ? "font-semibold text-foreground" : "text-foreground"
              }`}
            >
              {group.label}
              <Chevron dir={isOpen ? "up" : "down"} className="h-4 w-4 text-muted" />
            </button>
            {isOpen && (
              <div id={panelId} className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
                {group.items.map((item) => {
                  const active = isAdminMenuActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={itemClass(active)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-auto flex flex-col gap-3 border-t border-border px-3 pt-4 pb-2">
        <AdminThemeToggle theme={theme} onChange={onTheme} />
        <LogoutButton />
      </div>
    </nav>
  );
}
