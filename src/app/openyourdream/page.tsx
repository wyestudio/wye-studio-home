import type { Metadata } from "next";
import { IntroSection } from "./IntroSection";
import { TarotGame } from "./TarotGame";

export const metadata: Metadata = {
  title: { absolute: "꿈의 포문" },
  description: "꿈의 포문 — 오늘의 카드를 골라보세요.",
  robots: { index: false, follow: false },
};

export default function OpenYourDreamPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <IntroSection />
      <TarotGame />
    </div>
  );
}
