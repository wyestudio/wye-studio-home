"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { handlePointerFillOrigin } from "@/lib/pointerFillOrigin";

interface PointerFillButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function PointerFillButton({
  href,
  children,
  className = "",
}: PointerFillButtonProps) {
  /*
    ⚠️ `legacyBehavior` + 안쪽 `<a>` 를 쓰지 않는다. Next 16 에서 지원 중단이라
       개발 모드에서 **오류 오버레이가 화면을 덮는다**(2026-10-09 지적).
       Link 가 스스로 <a> 를 그리므로 속성을 Link 에 바로 준다.
  */
  return (
    <Link
      href={href}
      className={`apply-submit-button relative inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-body-sm transition-all ${className}`}
      onPointerEnter={handlePointerFillOrigin}
    >
      <span aria-hidden className="apply-submit-fill" />
      <span className="apply-submit-label">{children}</span>
    </Link>
  );
}
