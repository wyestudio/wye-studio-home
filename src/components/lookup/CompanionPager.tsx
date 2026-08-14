"use client";

import React, { useState } from "react";

export function CompanionPager({
  count,
  children,
}: {
  count: number;
  children: (index: number) => React.ReactNode;
}) {
  const [index, setIndex] = useState(0);

  if (count <= 1) return <>{children(0)}</>;

  const isFirst = index === 0;
  const isLast = index === count - 1;

  return (
    <div className="flex flex-col gap-3">
      {children(index)}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => setIndex((i) => i - 1)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-all ${
            isFirst
              ? "pointer-events-none border-border bg-surface text-muted opacity-30"
              : "border-border bg-surface text-foreground hover:border-brand hover:text-brand"
          }`}
        >
          ‹
        </button>
        <span className="text-xs text-muted">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          disabled={isLast}
          onClick={() => setIndex((i) => i + 1)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-all ${
            isLast
              ? "pointer-events-none border-border bg-surface text-muted opacity-30"
              : "border-border bg-surface text-foreground hover:border-brand hover:text-brand"
          }`}
        >
          ›
        </button>
      </div>
    </div>
  );
}
