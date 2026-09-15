"use client";

import { useState } from "react";

export type FaqItem = { q: string; a: string };

function FaqRow({ item, lg }: { item: FaqItem; lg: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-panel-border bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-4 text-left ${lg ? "px-5 py-4 sm:px-7 sm:py-6" : "px-5 py-4"}`}
        aria-expanded={open}
      >
        <span className={`font-bold text-foreground ${lg ? "sm:text-lg" : ""}`}>{item.q}</span>
        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform duration-200 ${lg ? "text-lg sm:text-2xl" : "text-lg"}`}
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
      {open && (
        <p
          className={
            lg
              ? "px-5 pb-4 text-sm leading-relaxed text-muted sm:px-7 sm:pb-6 sm:text-base"
              : "px-5 pb-4 text-sm text-muted"
          }
        >
          {item.a}
        </p>
      )}
    </div>
  );
}

/** size="lg" 는 테마 상세(한 화면에 블록 하나)용. 다른 페이지는 기본 크기 그대로. */
export function FlatFaqAccordion({ items, size = "md" }: { items: FaqItem[]; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className={`flex flex-col ${lg ? "gap-3 sm:gap-4" : "gap-3"}`}>
      {items.map((item) => (
        <FaqRow key={item.q} item={item} lg={lg} />
      ))}
    </div>
  );
}
