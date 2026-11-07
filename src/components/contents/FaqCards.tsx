import { useId } from "react";
import { RichText } from "@/components/ui/RichText";

/*
  자주 묻는 질문 — Q · A 카드(2026-10-29 대표님). 단체 예약 페이지(/group)의 자주 묻는 질문과
  같은 모양이다. 질문 앞 Q 배지, 답 앞 A, 펼친 카드는 테두리에 강조색.

  접기는 /group 처럼 <details> 로 한다(2026-11-07) — 답변이 접힌 채로도 서버 HTML 에 들어가
  검색엔진 · AI 가 읽는다. 같은 name 이라 하나를 펴면 나머지는 접힌다(전과 같은 동작).
  ⚠️ 다시 `isOpen && …` 처럼 조건부로 그리지 않는다.

  ⚠️ 공지 페이지의 자주 묻는 질문은 FaqAccordion 이다. 이 카드는 테마 상세에서만 쓴다.
*/
export function FaqCards({
  items,
  accent,
  linkClassName,
}: {
  items: { q: string; a: string }[];
  accent: string;
  /** 답변 안 링크 모양(RichText 참고). */
  linkClassName?: string;
}) {
  const group = useId();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5 sm:gap-3">
      {items.map((f) => (
        <details
          key={f.q}
          name={group}
          className="group/faq rounded-xl border border-line-subtle bg-fill-subtle transition-colors open:border-[color:var(--faq-accent)]"
          style={{ "--faq-accent": `${accent}88` } as React.CSSProperties}
        >
          <summary className="flex min-h-[56px] w-full cursor-pointer list-none items-center gap-3 px-4 py-3 text-left sm:px-5 [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-label font-extrabold"
              style={{ backgroundColor: `${accent}26`, color: accent }}
            >
              Q
            </span>
            <span className="flex-1 text-body font-semibold text-foreground break-keep">{f.q}</span>
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fill text-muted transition-transform group-open/faq:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="flex gap-3 px-4 pb-5 sm:px-5">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center text-label font-extrabold text-muted"
            >
              A
            </span>
            <div className="flex-1 text-body leading-relaxed text-muted">
              <RichText text={f.a} linkClassName={linkClassName} />
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
