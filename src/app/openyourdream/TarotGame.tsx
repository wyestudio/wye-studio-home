"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { TAROT_CARDS } from "./cards";
import { TarotCard } from "./TarotCard";

const CARD_IDS = TAROT_CARDS.map((card) => card.id);

function shuffledIds(): string[] {
  const ids = [...CARD_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function TarotGame() {
  const [order, setOrder] = useState<string[]>(CARD_IDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  function handleReset() {
    setSelectedId(null);
    setOrder(shuffledIds());
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-10">
      <p className="mb-8 text-center text-base text-white/80">
        {selectedId ? "카드가 당신에게 말을 건넵니다." : "마음이 가는 카드를 한 장 골라보세요."}
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {order.map((id) => {
          const card = TAROT_CARDS.find((c) => c.id === id)!;
          return (
            <motion.div
              key={id}
              layout
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 26 }
              }
            >
              <TarotCard
                card={card}
                isFlipped={selectedId === id}
                isLocked={selectedId !== null}
                onSelect={() => setSelectedId((prev) => prev ?? id)}
              />
            </motion.div>
          );
        })}
      </div>
      {selectedId ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-white/30 px-6 py-2 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/10"
          >
            다시 고르기
          </button>
        </div>
      ) : null}
    </section>
  );
}
