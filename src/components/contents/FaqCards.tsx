"use client";

import { useState } from "react";
import { RichText } from "@/components/ui/RichText";

/*
  자주 묻는 질문 — Q · A 카드(2026-10-29 대표님). 단체 예약 페이지(/group)의 자주 묻는 질문과
  같은 모양이다. 질문 앞 Q 배지, 답 앞 A, 펼친 카드는 테두리에 강조색.

  ⚠️ 공지 페이지 등 다른 곳의 자주 묻는 질문은 여전히 FlatFaqAccordion 이다. 테마 상세에서만 쓴다.
*/
export function FaqCards({
  items,
  accent,
  linkClassName,
}: {
  items: { q: string; a: string }[];
  accent: string;
  /** 답변 안 링크 모양(RichText 참고). */
  linkClassName?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 sm:gap-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={f.q}
            className="rounded-xl border border-line-subtle bg-fill-subtle transition-colors"
            style={isOpen ? { borderColor: `${accent}88` } : undefined}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-label font-extrabold"
                style={{ backgroundColor: `${accent}26`, color: accent }}
              >
                Q
              </span>
              <span className="flex-1 text-body font-semibold text-foreground break-keep">{f.q}</span>
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill text-muted transition-transform ${isOpen ? "rotate-45" : ""}`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="flex gap-3 px-4 pb-5 sm:px-5">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center text-label font-extrabold text-muted"
                >
                  A
                </span>
                <div className="flex-1 text-body leading-relaxed text-muted">
                  <RichText text={f.a} linkClassName={linkClassName} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
