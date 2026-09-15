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
          className="fixed left-1/2 top-[calc(var(--header-height)+12px)] z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger shadow-lg sm:px-5 sm:py-3.5 sm:text-base"
        >
          <span>{message}</span>
          {/* 닫기 표시는 글자(✕)가 아니라 SVG — 본문 글꼴 SUIT 에 없는 글자라 기기마다 모양이 달라진다. */}
          <button type="button" onClick={onClose} aria-label="닫기" className="text-danger/70 hover:text-danger">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
