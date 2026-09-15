"use client";

import React from "react";
import { Chevron } from "@/components/ui/Chevron";

function attendeeTabClassName(isActive: boolean, hasError: boolean) {
  // 넓은 화면에서 한 단계씩 키운다(테마 상세 비율).
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all sm:h-10 sm:w-10 sm:text-sm lg:h-11 lg:w-11 lg:text-base";
  if (hasError) {
    return `${base} ${isActive ? "border-danger bg-danger text-foreground" : "border-danger bg-danger-soft text-danger"}`;
  }
  return `${base} ${isActive ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface text-muted hover:border-brand hover:text-foreground"}`;
}

function arrowButtonClassName(disabled: boolean) {
  return `flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition-all sm:h-10 sm:w-10 lg:h-11 lg:w-11 ${
    disabled
      ? "pointer-events-none border-border bg-surface text-muted opacity-30"
      : "border-border bg-surface text-foreground hover:border-brand hover:text-brand"
  }`;
}

export function AttendeeTabs({
  count,
  activeIndex,
  errorIndexes,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  errorIndexes: Set<number>;
  onSelect: (index: number) => void;
}): React.ReactElement | null {
  if (count <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={activeIndex === 0}
        onClick={() => onSelect(activeIndex - 1)}
        className={arrowButtonClassName(activeIndex === 0)}
      >
        <Chevron dir="left" />
      </button>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={attendeeTabClassName(activeIndex === i, errorIndexes.has(i))}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={activeIndex === count - 1}
        onClick={() => onSelect(activeIndex + 1)}
        className={arrowButtonClassName(activeIndex === count - 1)}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}
