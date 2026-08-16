"use client";

import { useTransition } from "react";
import { logoutAdmin } from "@/app/admin/login/actions";

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
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
    >
      {isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
