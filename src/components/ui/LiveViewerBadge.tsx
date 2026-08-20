"use client";

import { useLiveViewerCount } from "@/lib/liveViewers";

export function LiveViewerBadge({
  scopeKey,
  label,
  className,
}: {
  scopeKey: string;
  label?: (count: number) => string;
  className?: string;
}) {
  const count = useLiveViewerCount(scopeKey);

  if (count === null) return null;

  const text = label ? label(count) : `지금 ${count}명이 보고 있어요`;

  return (
    <p
      className={`mx-auto flex w-fit items-center gap-2.5 rounded-full px-6 py-3 text-base font-extrabold text-brand sm:text-lg ${className ?? ""}`}
      style={{
        backgroundColor: "rgba(5,6,25,0.9)",
        border: "1px solid var(--brand)",
        boxShadow: "0 0 28px -2px var(--brand), 0 0 8px -1px var(--brand), inset 0 0 12px -4px var(--brand)",
      }}
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-brand" />
      </span>
      {text}
    </p>
  );
}
