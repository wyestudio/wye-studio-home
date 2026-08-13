"use client";

import Link from "next/link";
import { ReactNode } from "react";

export function RippleLinkButton({
  href,
  disabled,
  children,
  className = "",
}: {
  href: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  function handlePointerEnter(e: React.PointerEvent<HTMLAnchorElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--origin-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--origin-y", `${e.clientY - rect.top}px`);
    const diagonal = Math.hypot(rect.width, rect.height);
    el.style.setProperty("--fill-size", `${diagonal * 2}px`);
  }

  if (disabled) {
    return (
      <span className={`apply-submit-button pointer-events-none inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm opacity-50 ${className}`}>
        <span aria-hidden className="apply-submit-fill" />
        <span className="apply-submit-label">{children}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      onPointerEnter={handlePointerEnter}
      className={`apply-submit-button relative inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-sm transition-all ${className}`}
    >
      <span aria-hidden className="apply-submit-fill" />
      <span className="apply-submit-label">{children}</span>
    </Link>
  );
}
