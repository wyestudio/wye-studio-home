import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { HudPlaceholder } from "@/components/ui/HudPlaceholder";
import { RichText } from "@/components/ui/RichText";
import type { Faq } from "@/lib/content";

const HEADING = "mb-6 text-center text-2xl font-extrabold sm:mb-10 sm:text-3xl lg:text-4xl";

/** 표시 전용. 데이터는 서버에서 받아 내려준다. */
export function FaqSection({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) {
    return (
      <section>
        <h2 className={HEADING}>자주 묻는 질문</h2>
        <HudPlaceholder label="등록된 질문이 없습니다." />
      </section>
    );
  }

  return (
    <section>
      <h2 className={HEADING}>자주 묻는 질문</h2>
      {/*
        FaqAccordion(공용 ui)은 크기가 고정이라 여기서 안쪽 글자·여백만 키운다.
        [&_button]·[&_p] 가 더 구체적인 선택자라 부품 안의 기본 크기 클래스를 이긴다.
      */}
      <FaqAccordion
        className="sm:gap-4 sm:[&_button]:px-7 sm:[&_button]:py-6 sm:[&_button]:text-lg sm:[&_p]:px-7 sm:[&_p]:pb-6 sm:[&_p]:text-base lg:[&_p]:text-lg"
        items={faqs.map((f) => ({ q: f.question, a: <RichText text={f.answer} /> }))}
      />
    </section>
  );
}
