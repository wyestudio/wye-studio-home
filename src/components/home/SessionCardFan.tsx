"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { SessionCard } from "@/components/home/SessionCard";
import { ComingSoonCard } from "@/components/home/ComingSoonCard";
import type { Session } from "@/types/domain";

type Item = {
  key: string;
  node: React.ReactNode;
};

export function SessionCardFan({ sessions }: { sessions: Session[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const items: Item[] = [
    ...sessions.map((session) => ({
      key: session.id,
      node: <SessionCard session={session} />,
    })),
    {
      key: "coming-soon",
      node: <ComingSoonCard />,
    },
  ];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const getCardOffset = (index: number) => {
    const offset = (index - activeIndex + items.length) % items.length;
    if (offset === 0) {
      return { x: 0, y: 0, rotate: 0, scale: 1, zIndex: 30, opacity: 1 };
    } else if (offset === 1) {
      return { x: 120, y: 20, rotate: 8, scale: 0.92, zIndex: 20, opacity: 0.8 };
    } else {
      return { x: -120, y: 20, rotate: -8, scale: 0.92, zIndex: 20, opacity: 0.8 };
    }
  };

  const handleCardClick = (index: number) => {
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <div className="relative w-full flex items-center justify-center py-8 px-4 sm:px-6 sm:py-12">
      {/* 배경 컨테이너 */}
      <div className="relative w-full h-96 sm:h-96 lg:h-[420px] flex items-center justify-center">
        {/* 카드 컨테이너 */}
        <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-2xl h-full flex items-center justify-center">
          {items.map((item, index) => {
            const offset = getCardOffset(index);
            const isCenter = index === activeIndex;
            const isSidebar = index !== activeIndex;

            return (
              <motion.div
                key={item.key}
                className={`absolute w-64 sm:w-80 lg:w-96 cursor-pointer`}
                animate={{
                  x: offset.x,
                  y: offset.y,
                  rotate: offset.rotate,
                  scale: offset.scale,
                  zIndex: offset.zIndex,
                  opacity: offset.opacity,
                }}
                transition={{
                  duration: 0.4,
                  ease: "easeInOut",
                }}
                onClick={() => {
                  if (isSidebar) {
                    handleCardClick(index);
                  }
                }}
              >
                <div className="h-80 sm:h-80 lg:h-96 w-full">
                  {isCenter ? (
                    <div className="w-full h-full">{item.node}</div>
                  ) : (
                    <div className="w-full h-full pointer-events-none">{item.node}</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 좌측 화살표 버튼 */}
      <button
        onClick={handlePrev}
        aria-label="이전 회차 보기"
        className="absolute left-0 sm:left-2 lg:left-4 top-1/2 -translate-y-1/2 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity hover:opacity-90 active:scale-95 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* 우측 화살표 버튼 */}
      <button
        onClick={handleNext}
        aria-label="다음 회차 보기"
        className="absolute right-0 sm:right-2 lg:right-4 top-1/2 -translate-y-1/2 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity hover:opacity-90 active:scale-95 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
