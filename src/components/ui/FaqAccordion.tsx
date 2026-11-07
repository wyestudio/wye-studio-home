import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode };

/*
  접기는 브라우저 기본 <details> 로 한다(2026-11-07) — 답변이 접힌 채로도 서버 HTML 에 들어가
  검색엔진 · AI 가 읽는다. 전에는 펼칠 때만 답변을 그려서 구글봇 기준 HTML 에 답변이 0개였다.
  ⚠️ 다시 `open && …` 처럼 조건부로 그리지 않는다.
*/
export function FaqAccordion({ items, className = "" }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {items.map((item) => (
        <details key={item.q} className="group/faq hud-panel hud-panel-glow relative">
          <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left [&::-webkit-details-marker]:hidden">
            <span className="font-semibold">{item.q}</span>
            <span aria-hidden className="shrink-0 text-h3 text-muted transition-transform duration-300 group-open/faq:rotate-45">
              +
            </span>
          </summary>
          <p className="px-5 pb-4 text-body-sm text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
