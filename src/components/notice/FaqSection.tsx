import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { HudPlaceholder } from "@/components/ui/HudPlaceholder";
import { RichText } from "@/components/ui/RichText";
import type { Faq } from "@/lib/content";

/** 표시 전용. 데이터는 서버에서 받아 내려준다. */
export function FaqSection({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) {
    return (
      <section>
        <h2 className="mb-6 text-center text-xl font-extrabold">자주 묻는 질문</h2>
        <HudPlaceholder label="등록된 질문이 없습니다." />
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-6 text-center text-xl font-extrabold">자주 묻는 질문</h2>
      <FaqAccordion
        items={faqs.map((f) => ({ q: f.question, a: <RichText text={f.answer} /> }))}
      />
    </section>
  );
}
