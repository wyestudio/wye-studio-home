"use client";

import { useState } from "react";
import { RichText } from "@/components/ui/RichText";

export type FaqItem = { q: string; a: string };

function FaqRow({ item, lg, linkClassName }: { item: FaqItem; lg: boolean; linkClassName?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-panel-border bg-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-4 text-left ${lg ? "px-5 py-4 sm:px-7 sm:py-6" : "px-5 py-4"}`}
        aria-expanded={open}
      >
        <span className={`font-semibold text-foreground ${lg ? "text-h3" : ""}`}>{item.q}</span>
        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform duration-200 ${lg ? "text-lg sm:text-2xl" : "text-lg"}`}
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
      {open && (
        // 답변은 RichText 로 그린다 — 운영자가 **굵게** 와 [문구](주소) 링크를
        // 쓸 수 있어야 한다. 링크 없는 답변은 전과 똑같이 보인다.
        <div
          className={
            lg
              ? "px-5 pb-4 text-body leading-relaxed text-muted sm:px-7 sm:pb-6"
              : "px-5 pb-4 text-body-sm text-muted"
          }
        >
          <RichText text={item.a} linkClassName={linkClassName} />
        </div>
      )}
    </div>
  );
}

/** size="lg" 는 테마 상세(한 화면에 블록 하나)용. 다른 페이지는 기본 크기 그대로. */
export function FlatFaqAccordion({
  items,
  size = "md",
  linkClassName,
}: {
  items: FaqItem[];
  size?: "md" | "lg";
  /** 답변 안 링크 모양. 본문에 묻히면 안 되는 블록에서만 넘긴다(RichText 참고). */
  linkClassName?: string;
}) {
  const lg = size === "lg";
  return (
    <div className={`flex flex-col ${lg ? "gap-3 sm:gap-4" : "gap-3"}`}>
      {items.map((item) => (
        <FaqRow key={item.q} item={item} lg={lg} linkClassName={linkClassName} />
      ))}
    </div>
  );
}
