"use client";

import { useState } from "react";

/*
  진행 순서를 한 줄 막대로 — 단계 이름만 보이고, 누르면 그 단계 설명이 열린다(2026-10-29 대표님).

  왜
    예전 진행 순서는 단계마다 제목 + 설명을 세로로 늘어놓아 휴대폰에서 658px 였고, 바로 아래
    「이렇게 플레이해요」 그림과 같은 이야기를 두 번 했다. 지금은 '전체 흐름은 막대로, 플레이 방식은
    그림으로' 나눠 한 블록에 둔다(ThemeBlocks 의 timetable).

  ⚠️ 단계 이름은 어드민 진행 순서(timetable) 의 제목 그대로다. 칸이 좁아 두 줄까지 꺾일 수 있다.
*/
export function ScheduleStrip({ items, accent }: { items: { title: string; desc?: string }[]; accent: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const cur = open === null ? null : items[open];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ol className="relative flex" aria-label="진행 순서">
        {/* 단계 사이를 잇는 선 — 첫 점 가운데에서 끝 점 가운데까지 */}
        <span
          aria-hidden
          className="absolute top-4 h-0.5 bg-line"
          style={{ left: `${50 / items.length}%`, right: `${50 / items.length}%` }}
        />
        {items.map((t, i) => {
          const on = open === i;
          return (
            <li key={i} className="relative flex flex-1 flex-col items-center">
              <button
                type="button"
                onClick={() => setOpen(on ? null : i)}
                aria-expanded={on}
                className="flex w-full flex-col items-center gap-2 px-1"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-label font-extrabold transition-colors"
                  style={{
                    borderColor: accent,
                    backgroundColor: on ? accent : "var(--color-background)",
                    color: on ? "var(--color-background)" : accent,
                  }}
                >
                  {i + 1}
                </span>
                <span className={`text-center text-label font-semibold break-keep ${on ? "" : "text-muted"}`}>
                  {t.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {cur?.desc ? (
        <p
          className="mt-4 rounded-lg border px-4 py-3 text-center text-body-sm leading-relaxed text-muted break-keep"
          style={{ borderColor: `${accent}55`, backgroundColor: `${accent}12` }}
        >
          {cur.desc}
        </p>
      ) : (
        <p className="mt-4 text-center text-body-sm text-muted">단계를 누르면 설명이 보여요.</p>
      )}
    </div>
  );
}
