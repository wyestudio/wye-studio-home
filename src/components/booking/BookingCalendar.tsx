"use client";

import { useMemo, useState } from "react";
import { Chevron } from "@/components/ui/Chevron";

/**
 * 예약 달력.
 *
 * 회차 목록을 버튼으로 늘어놓으면 매주 회차가 쌓일수록 길어진다.
 * 달력이면 개수와 무관하게 크기가 일정하고, 고객이 "이번 주 토요일"처럼
 * 날짜로 생각하는 방식과도 맞는다.
 *
 * ⚠️ 모든 날짜 계산은 KST 기준이다. 서버가 UTC 로 돌기 때문에
 *    new Date() 의 로컬 메서드를 쓰면 자정 근처에서 하루가 밀린다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → KST 기준 'YYYY-MM-DD' */
function kstYmd(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 그 달의 1일 (KST 기준) */
function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function addMonths(ymd: string, delta: number): string {
  const [y, m] = ymd.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** 달력에 그릴 칸들. 그 달 1일의 요일만큼 앞을 비운다. */
function monthCells(monthYmd: string): (string | null)[] {
  const [y, m] = monthYmd.split("-").map(Number);
  // KST 정오로 만들어 시간대 경계를 피한다.
  const first = new Date(Date.UTC(y, m - 1, 1, 3));
  const lead = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0, 3)).getUTCDate();

  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${monthYmd.slice(0, 7)}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/*
  달 넘기는 화살표.
  ⚠️ 예전에는 text-muted 아이콘만 덩그러니 있어서 "눌리는 것"으로 안 보였다
     (2026-10-01 제보). 테두리 있는 칸 + 밝은 아이콘으로 바꿔 누를 자리를
     먼저 보이게 하고, 더 갈 곳이 없을 때만 흐려진다.
*/
const ARROW_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 " +
  "text-white/85 transition-colors hover:border-white/45 hover:bg-white/10 hover:text-white " +
  "disabled:border-white/10 disabled:text-white/20 disabled:hover:bg-transparent";

export function BookingCalendar({
  /** 회차가 있는 날짜 → 신청 가능 여부 · 얼리버드 여부 */
  dateStatus,
  selected,
  onSelect,
  accentColor,
  openingDate,
  promoColor = null,
  promoLabel = "얼리버드",
}: {
  dateStatus: Map<string, { hasOpen: boolean; hasEarlyBird?: boolean }>;
  selected: string;
  onSelect: (ymd: string) => void;
  accentColor: string;
  /** 이 날짜 아래에 '오픈' 이라고 적는다(정식 오픈 안내). 없으면 표시 안 함. */
  openingDate: string | null;
  /**
   * 얼리버드 날짜를 칠할 색. 프로모션이 꺼져 있으면 null 이고, 그때는
   * 범례도 통째로 안 그린다 — 뜻이 하나뿐인 달력에 범례는 잡음이다.
   */
  promoColor?: string | null;
  promoLabel?: string;
}) {
  const today = kstYmd(new Date());

  // 회차가 있는 첫 달부터 보여준다. 없으면 이번 달.
  const firstMonth = useMemo(() => {
    const ds = [...dateStatus.keys()].sort();
    return monthStart(ds[0] ?? today);
  }, [dateStatus, today]);

  const lastMonth = useMemo(() => {
    const ds = [...dateStatus.keys()].sort();
    return monthStart(ds[ds.length - 1] ?? today);
  }, [dateStatus, today]);

  const [month, setMonth] = useState(() => monthStart(selected || firstMonth));

  const cells = monthCells(month);
  /*
    회차가 있는 달의 **앞뒤 한 달까지** 넘길 수 있다(2026-10-01 요청).
    회차가 없는 달도 열어 두는 이유: 달력이 그 달에 갇혀 있으면 "다음 달은
    아직 안 열렸나" 를 확인할 방법이 없어, 없는 걸 확인하러 문의가 온다.
    빈 달은 날짜가 전부 눌리지 않는 상태로 보이므로 그 자체가 답이 된다.
  */
  const canPrev = month > addMonths(firstMonth, -1);
  const canNext = month < addMonths(lastMonth, 1);

  const [y, m] = month.split("-");

  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          disabled={!canPrev}
          aria-label="이전 달"
          className={ARROW_BUTTON}
        >
          <Chevron dir="left" className="h-5 w-5" />
        </button>
        <p className="font-bold">
          {Number(y)}년 {Number(m)}월
        </p>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          disabled={!canNext}
          aria-label="다음 달"
          className={ARROW_BUTTON}
        >
          <Chevron dir="right" className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 text-xs ${i === 0 ? "text-red-400/70" : i === 6 ? "text-sky-400/70" : "text-muted"}`}
          >
            {w}
          </div>
        ))}

        {cells.map((ymd, i) => {
          if (!ymd) return <div key={`pad-${i}`} />;

          const status = dateStatus.get(ymd);
          const day = Number(ymd.slice(8));
          const isSelected = ymd === selected;
          // 얼리버드인 날은 **고른 뒤에도** 같은 색으로 남는다. 색이 곧 뜻이라
          // (프로모션 색 = 얼리버드), 선택했다고 색이 바뀌면 그 뜻이 사라진다.
          const earlyBird = Boolean(promoColor && status?.hasEarlyBird);
          const dayColor = earlyBird ? promoColor! : accentColor;
          const isToday = ymd === today;
          // 칸이 작아서 둘 다 붙일 자리는 없다. 오픈일이 더 알릴 값어치가 있다.
          const note = ymd === openingDate ? "오픈" : isToday ? "오늘" : null;

          // 회차가 없는 날은 누를 수 없다. 있는데 전부 마감이면 눌러서 확인은 된다.
          const disabled = !status;

          return (
            <button
              key={ymd}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(ymd)}
              aria-label={`${Number(m)}월 ${day}일${earlyBird ? ` ${promoLabel}` : ""}${note ? ` ${note}` : ""}`}
              aria-pressed={isSelected}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors
                ${disabled ? "text-white/20" : "hover:bg-white/10"}
                ${isSelected ? "font-bold" : ""}
                ${isToday && !isSelected ? "ring-1 ring-white/25" : ""}`}
              style={isSelected ? { backgroundColor: dayColor, color: "#0a0a12" } : undefined}
            >
              <span className={note ? "leading-none" : ""}>{day}</span>

              {note && (
                <span
                  className="mt-0.5 text-[9px] leading-none"
                  style={isSelected ? undefined : { color: dayColor }}
                >
                  {note}
                </span>
              )}

              {/* 회차가 있는 날 표시. 전부 마감이면 흐리게. 글씨가 있으면 생략. */}
              {status && !isSelected && !note && (
                <span
                  className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{
                    backgroundColor: dayColor,
                    opacity: status.hasOpen ? 1 : 0.3,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/*
        범례. 색이 두 가지 뜻을 갖게 된 순간부터는 설명이 없으면 프로모션 색이 그냥
        '다른 색' 으로만 보인다. 프로모션이 꺼져 있으면(promoColor 없음) 색이
        한 가지뿐이라 범례를 그리지 않는다.
      */}
      {promoColor && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-2.5">
          <LegendDot color={promoColor} label={promoLabel} />
          <LegendDot color={accentColor} label="일반" />
          <LegendDot color={accentColor} label="마감" opacity={0.3} />
        </div>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
  opacity = 1,
}: {
  color: string;
  label: string;
  opacity?: number;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, opacity }}
      />
      {label}
    </span>
  );
}
