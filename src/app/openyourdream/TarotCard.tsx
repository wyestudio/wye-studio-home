"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { CardBack, CardFront } from "./CardArt";
import type { TarotCard as TarotCardData } from "./cards";

export function TarotCard({
  card,
  isFlipped,
  isLocked,
  onSelect,
}: {
  card: TarotCardData;
  isFlipped: boolean;
  isLocked: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLocked && !isFlipped}
      aria-label={isFlipped ? `${card.name}: ${card.fortune}` : "카드를 뒤집어 운세 보기"}
      className={`relative h-64 w-44 shrink-0 [perspective:1000px] transition-opacity duration-500 ${
        isLocked && !isFlipped ? "opacity-30" : "opacity-100"
      } disabled:cursor-default`}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }
        }
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <CardBack />
        </div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <CardFront card={card} />
        </div>
      </motion.div>
    </button>
  );
}
