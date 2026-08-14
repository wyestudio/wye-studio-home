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
  return (
    <Link href={href} legacyBehavior>
      <a
        className={`apply-submit-button relative inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm transition-all ${className}`}
        onPointerEnter={handlePointerFillOrigin}
      >
        <span aria-hidden className="apply-submit-fill" />
        <span className="apply-submit-label">{children}</span>
      </a>
    </Link>
  );
}
