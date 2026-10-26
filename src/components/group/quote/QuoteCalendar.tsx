"use client";

import { useState } from "react";
import { Chevron } from "@/components/ui/Chevron";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 희망 날짜 달력.
 *
 * 마감 표시는 **운영자가 막아 둔 날만** 나온다(어드민 > 단체 예약 문의). 단체 일정
 * 데이터가 따로 없어서, 그 밖의 날은 '고를 수 있음' 이지 '비어 있음' 이 아니다 —
 * 그래서 남은 자리 같은 표시는 하지 않는다.
 */
export function QuoteCalendar({
  value,
  first,
  last,
  isClosed,
  onPick,
  bare = false,
}: {
  value: string | null;
  first: string;
  last: string;
  /** 그날 고를 수 있는 회차가 하나도 없으면 true. */
  isClosed: (date: string) => boolean;
  onPick: (date: string) => void;
  /** 견적 카드 안에 넣을 때 — 테두리·배경 없이 그린다(카드 안에 카드가 또 생기지 않게). */
  bare?: boolean;
}) {
  const [month, setMonth] = useState(() => openingMonth(value, first)); // 'YYYY-MM'

  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const canPrev = month > first.slice(0, 7);
  const canNext = month < last.slice(0, 7);

  function shift(n: number) {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  const navBtn =
    "flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition hover:bg-fill disabled:opacity-25";

  return (
    // 넓은 화면에서 칸 폭대로 늘리면 달력 하나가 화면을 다 먹는다 — 폭을 잡아 둔다.
    <div className={bare ? "" : "max-w-md rounded-xl border border-panel-border bg-panel p-3 sm:p-4"}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={navBtn} disabled={!canPrev} onClick={() => shift(-1)} aria-label="이전 달">
          <Chevron dir="left" />
        </button>
        <p className="text-h3 font-semibold" aria-live="polite">
          {y}년 {m}월
        </p>
        <button type="button" className={navBtn} disabled={!canNext} onClick={() => shift(1)} aria-label="다음 달">
          <Chevron dir="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-micro text-muted">
        {WEEK.map((w, i) => (
          <span key={w} className={`py-1.5 ${i === 0 || i === 6 ? "text-foreground/70" : ""}`}>
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const out = date < first || date > last;
          const closed = !out && isClosed(date);
          const selected = date === value;
          const day = Number(date.slice(8));
          return (
            <button
              key={date}
              type="button"
              disabled={out || closed}
              onClick={() => onPick(date)}
              aria-pressed={selected}
              aria-label={`${m}월 ${day}일${closed ? " 마감" : out ? " 선택 불가" : ""}`}
              className={`flex h-12 flex-col items-center justify-center rounded-lg text-body transition ${
                selected
                  ? "bg-[#f082f4] font-semibold text-[#141414]"
                  : out
                    ? "text-muted/40"
                    : closed
                      ? "text-muted/60"
                      : "text-foreground hover:bg-fill"
              }`}
            >
              <span className={closed ? "line-through" : ""}>{day}</span>
              {closed && <span className="text-micro leading-none">마감</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 처음 펼칠 달. 고른 날이 있으면 그 달.
 * 이번 달에 고를 날이 일주일도 안 남았으면 다음 달부터 보여 준다 — 회색 칸만 가득한
 * 달을 먼저 보여 주면 '고를 날이 없나' 로 읽힌다.
 */
function openingMonth(value: string | null, first: string): string {
  if (value) return value.slice(0, 7);
  const [y, m, d] = first.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (daysInMonth - d + 1 >= 7) return first.slice(0, 7);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}
