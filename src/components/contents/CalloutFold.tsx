"use client";

import { useState } from "react";
import { Chevron } from "@/components/ui/Chevron";
import { RichText } from "@/components/ui/RichText";

/*
  「참여 전 꼭 확인해주세요」 — 제목만 한 줄씩 보이고, 궁금한 것만 눌러 펼친다(2026-10-29 대표님).

  왜 접어 두나
    카드 여섯 장에 설명이 전부 펼쳐져 있어 휴대폰에서 이 블록만 1,187px 였다(페이지에서 가장
    긴 글 덩어리). 처음부터 다 보여 주면 피로하다. 읽어도 되고 안 읽어도 되는 안내라 접어 둔다.
    ('몇 개 확인했는지' 진행 막대를 붙여 봤지만 굳이 그럴 블록이 아니라 뺐다 — 대표님.)

  ⚠️ 제목에 핵심을 적어야 한다 — 안 누르는 손님은 제목만 읽는다("진행일 2일 전부터 환불 불가" 처럼).
  ⚠️ season-card · season-callout-badge 는 시즌 스킨이 카드 · 번호 모양을 바꿀 때 잡는 이름이다(season.css).
*/
export function CalloutFold({
  items,
  badges,
}: {
  items: { title: string; desc?: string }[];
  /** 번호 자리에 들어갈 그림(번호 + 시즌 그림). 서버에서 그려 넘긴다. */
  badges: React.ReactNode[];
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {items.map((p, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="season-card overflow-hidden rounded-xl border border-panel-border bg-panel">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left sm:gap-4 sm:px-5"
            >
              {badges[i]}
              <span className="flex-1 text-body font-semibold text-foreground break-keep">{p.title}</span>
              <Chevron
                dir="down"
                className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && p.desc && (
              // 번호 칸(32~36px) + 간격만큼 들여 제목과 줄을 맞춘다.
              <div className="pb-4 pl-[3.75rem] pr-5 text-body leading-relaxed text-muted sm:pl-[4.25rem]">
                <RichText text={p.desc} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
