"use client";

import { useTransition } from "react";
import { logoutAdmin } from "@/app/(site)/admin/login/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAdmin();
      window.location.href = "/login";
    });
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      // 왼쪽 메뉴 맨 아래에 놓인다. 자주 누르는 버튼이 아니라 조용하게 둔다(2026-11-27 관리자 개편 — 예전엔 빨간 버튼이었다).
      className="min-h-11 w-full rounded-lg border border-border px-4 text-body-sm font-semibold text-foreground transition-colors hover:bg-fill disabled:opacity-50"
    >
      {isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
