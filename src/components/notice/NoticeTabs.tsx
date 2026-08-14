"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { NoticeSection } from "@/components/notice/NoticeSection";
import { FaqSection } from "@/components/notice/FaqSection";
import { RefundSection } from "@/components/notice/RefundSection";

type TabKey = "notice" | "faq" | "refund";

const TABS = [
  { key: "notice" as const, label: "공지사항" },
  { key: "faq" as const, label: "자주 묻는 질문" },
  { key: "refund" as const, label: "환불요청" },
];

export function NoticeTabs() {
  const [selected, setSelected] = useState<TabKey>("notice");
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-8">
      {/* Tab Bar */}
      <div className="flex justify-center gap-3" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelected(tab.key)}
            role="tab"
            aria-selected={selected === tab.key}
            className="relative overflow-hidden rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              borderColor: selected === tab.key ? "var(--brand)" : "var(--border)",
              color: selected === tab.key ? "var(--brand-foreground)" : "var(--muted)",
            }}
          >
            <span className="relative z-10">{tab.label}</span>
            <AnimatePresence>
              {selected === tab.key && !reduceMotion && (
                <motion.span
                  initial={{ y: "100%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 z-0"
                  style={{ backgroundColor: "var(--brand)" }}
                />
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div role="tabpanel">
        {selected === "notice" && <NoticeSection />}
        {selected === "faq" && <FaqSection />}
        {selected === "refund" && <RefundSection />}
      </div>
    </div>
  );
}
