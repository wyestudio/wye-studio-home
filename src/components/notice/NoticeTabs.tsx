"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { NoticeSection } from "@/components/notice/NoticeSection";
import { FaqSection } from "@/components/notice/FaqSection";
import type { Notice, Faq } from "@/lib/content";

type TabKey = "notice" | "faq";

const TABS = [
  { key: "notice" as const, label: "공지사항" },
  { key: "faq" as const, label: "자주 묻는 질문" },
];

// 탭 전환만 클라이언트에서 한다. 데이터는 서버 페이지가 조회해 내려준다.
export function NoticeTabs({ notices, faqs }: { notices: Notice[]; faqs: Faq[] }) {
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
        {selected === "notice" && <NoticeSection notices={notices} />}
        {selected === "faq" && <FaqSection faqs={faqs} />}
      </div>
    </div>
  );
}
