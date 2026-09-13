"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * 템플릿에 쓸 수 있는 변수 목록. 눌러서 복사하고, hover 로 설명을 본다.
 *
 * 문자·슬랙이 같이 쓴다. 변수 이름·설명·예시는 화면마다 다르므로 전부 받는다.
 */
export function PlaceholderHints({
  placeholders,
  labels = {},
  examples = {},
}: {
  placeholders: string[];
  /** 변수 → 사람이 읽을 설명 */
  labels?: Record<string, string>;
  /** 변수 → 지금 기준 실제 예시값 */
  examples?: Record<string, string>;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  }

  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-2">
      {placeholders.map((key) => {
        const label = labels[key];
        const example = examples[key];
        return (
          <span key={key} className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
              onClick={() => handleCopy(key)}
              className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-glow transition-colors hover:border-brand"
            >
              {copied === key ? "복사됨!" : `{{${key}}}`}
            </button>
            <AnimatePresence>
              {hovered === key && (label || example) && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="glass-panel pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg px-3 py-2 text-xs"
                >
                  {label && <p className="font-semibold text-foreground">{label}</p>}
                  {/* 빈 값이 정상인 변수도 있어서 '(빈 값)' 으로 구분해 보여준다. */}
                  {example !== undefined && (
                    <p className="mt-0.5 text-muted">예: {example || "(빈 값)"}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </span>
        );
      })}
    </div>
  );
}
