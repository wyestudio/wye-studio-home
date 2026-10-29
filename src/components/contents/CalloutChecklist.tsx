"use client";

import { useState } from "react";
import { Chevron } from "@/components/ui/Chevron";
import { RichText } from "@/components/ui/RichText";

/*
  「참여 전 꼭 확인해주세요」 — 하나씩 눌러 확인하는 체크리스트(2026-10-29 대표님).

  왜 이렇게 바꿨나
    카드 여섯 장에 설명이 전부 펼쳐져 있어 휴대폰에서 이 블록만 1,187px 였다(페이지에서 가장
    긴 글 덩어리). 안 읽고 넘기기 딱 좋은 모양이었다. 제목만 한 줄씩 보이고, 누르면 설명이 열리며
    번호가 체크로 바뀐다. 위의 '6개 중 N개 확인' 이 끝까지 눌러 보게 만든다.

  ⚠️ 제목에 핵심을 적어야 한다 — 안 누르는 손님은 제목만 읽는다("진행일 2일 전부터 환불 불가" 처럼).
     어드민에서 항목을 쓸 때 이 점을 지킨다.
  ⚠️ 확인 표시는 이 화면에서만 산다(저장하지 않는다). 신청을 막는 장치가 아니다.
  ⚠️ season-card · season-callout-badge 는 시즌 스킨이 카드 · 번호 모양을 바꿀 때 잡는 이름이다(season.css).
*/
export function CalloutChecklist({
  items,
  badges,
  accent,
}: {
  items: { title: string; desc?: string }[];
  /** 번호 자리에 들어갈 그림(번호 + 시즌 그림). 서버에서 그려 넘긴다. */
  badges: React.ReactNode[];
  accent: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const done = seen.size;
  const all = done === items.length;

  const toggle = (i: number) => {
    setOpen((o) => (o === i ? null : i));
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {/* 진행 막대 — 몇 개 확인했는지 */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${(done / items.length) * 100}%`, backgroundColor: accent }}
          />
        </div>
        <p className="shrink-0 text-label font-semibold tabular-nums" style={all ? { color: accent } : undefined}>
          {all ? "모두 확인했어요" : `${items.length}개 중 ${done}개 확인`}
        </p>
      </div>

      {items.map((p, i) => {
        const isOpen = open === i;
        const checked = seen.has(i);
        return (
          <div
            key={i}
            className="season-card overflow-hidden rounded-xl border border-panel-border bg-panel transition-colors"
            style={checked ? { borderColor: `${accent}66` } : undefined}
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left sm:gap-4 sm:px-5"
            >
              {checked ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-background sm:h-9 sm:w-9"
                  style={{ backgroundColor: accent }}
                  aria-label="확인함"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : (
                badges[i]
              )}
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
