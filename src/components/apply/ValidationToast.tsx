"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";

export function ValidationToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="alert"
          initial={reduceMotion ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="fixed left-1/2 top-[calc(var(--header-height)+12px)] z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger shadow-lg"
        >
          <span>{message}</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-danger/70 hover:text-danger">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
