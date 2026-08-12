"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";

export type FaqItem = { q: string; a: string };

function FaqRow({ item, reduceMotion }: { item: FaqItem; reduceMotion: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hud-panel hud-panel-glow relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-bold">{item.q}</span>
        <span
          aria-hidden
          className="shrink-0 text-lg text-muted"
          style={
            reduceMotion
              ? undefined
              : { transition: "transform 0.3s ease", transform: open ? "rotate(45deg)" : "rotate(0deg)" }
          }
        >
          +
        </span>
      </button>
      {reduceMotion ? (
        open && <p className="px-5 pb-4 text-sm text-muted">{item.a}</p>
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <p className="px-5 pb-4 text-sm text-muted">{item.a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export function FaqAccordion({ items, className = "" }: { items: FaqItem[]; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {items.map((item) => (
        <FaqRow key={item.q} item={item} reduceMotion={reduceMotion} />
      ))}
    </div>
  );
}
