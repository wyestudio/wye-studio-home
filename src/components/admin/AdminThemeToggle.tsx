"use client";

import type { AdminTheme } from "@/components/admin/adminTheme";

/**
 * 관리자 라이트 / 다크 모드 스위치(2026-11-27 대표님). 기본은 라이트.
 *
 * 기억은 **기기별**이다 — 관리자 로그인이 공용 비밀번호라 사람을 가를 수 없다.
 * 쿠키에 둔다(localStorage 가 아니라): 서버가 첫 화면부터 고른 모드로 그려야
 * 밝은 화면이 잠깐 번쩍였다 어두워지는 일이 없다.
 *
 * 상태는 AdminShell 이 들고 있다(왼쪽 메뉴와 휴대폰 서랍에 스위치가 하나씩 있어 같이 움직여야 한다).
 * ⚠️ 누를 때 서버를 부르지 않는다(router.refresh 금지 — wye-server-cost). 표시(data-admin-theme)만
 *    바꾸면 admin.css 가 색을 전부 바꾼다. 쿠키는 다음에 열 때를 위한 것이다.
 */
export function AdminThemeToggle({ theme, onChange }: { theme: AdminTheme; onChange: (next: AdminTheme) => void }) {
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={() => onChange(dark ? "light" : "dark")}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-body-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span>다크 모드</span>
      {/* 스위치 모양. 켜짐/꺼짐은 위치 + 글자(aria-checked)로도 전한다 */}
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${dark ? "bg-brand" : "bg-muted"}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            dark ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
