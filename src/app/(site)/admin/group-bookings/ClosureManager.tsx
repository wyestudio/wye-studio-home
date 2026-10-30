"use client";

import { useState, useTransition } from "react";
import { BASE_MINUTES, addMinutes, durationLabel } from "@/lib/groupPricing";
import { addGroupClosure, removeGroupClosure } from "./actions";

type Closure = { id: string; date: string; start_time: string | null; minutes: number | null; note: string | null };

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
const dayOf = (d: string) => DAY[new Date(`${d}T00:00:00Z`).getUTCDay()];

/**
 * 단체 일정 마감 표시.
 *
 * 견적 화면(/group)의 달력·회차에 '마감' 으로 뜨고, 그 일정으로는 접수가 안 된다.
 * 종일, 또는 **시작 시각 + 소요 시간** 구간으로 막는다 — 그 구간과 겹치는 단체 시간은 못 고른다.
 * 고정 회차(11:30 · 15:30 · 19:30)로만 고르던 것을 구간으로 바꿨다(2026-10-30 대표님,
 * 평일 · 주말 모두 시간이 계속 조정된다).
 *
 * 해제는 두 번 눌러야 된다 — 목록을 훑다 잘못 누르면 막아 둔 날이 바로 열린다.
 */
export function ClosureManager({ closures }: { closures: Closure[] }) {
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(String(BASE_MINUTES / 60));
  const [mins, setMins] = useState("0");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!date) return setMessage("날짜를 고르세요.");
    if (!allDay && !time) return setMessage("시작 시각을 넣으세요. 하루를 다 막으려면 종일을 고르세요.");
    if (!allDay && !minutes) return setMessage("소요 시간을 넣으세요.");
    startTransition(async () => {
      const res = await addGroupClosure({ date, time: allDay ? null : time, minutes: allDay ? null : minutes, note });
      setMessage("error" in res ? res.error : (res.message ?? "저장했습니다."));
      if (!("error" in res)) setNote("");
    });
  }

  // 소요 시간(분). 비었거나 0 이면 null.
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0) || null;

  function remove(id: string) {
    if (armed !== id) return setArmed(id);
    setArmed(null);
    startTransition(async () => {
      const res = await removeGroupClosure(id);
      setMessage("error" in res ? res.error : (res.message ?? "풀었습니다."));
    });
  }

  return (
    <section className="mb-10 rounded-xl border border-border bg-panel p-5">
      <h2 className="text-h3 font-semibold">일정 마감 표시</h2>
      <p className="mt-1 text-body-sm text-muted">
        시작 시각부터 소요 시간만큼 막습니다. 이 구간과 조금이라도 겹치는 단체 시간은 견적 화면에서 고를 수 없어요.
        <br />
        겹치는 바-ㅇ탈출 회차(파티 · 노말)도 같이 닫힙니다. 신청자가 있는 회차는 닫지 않고 알려 드려요.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-body-sm">
          날짜
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-body-sm"
            style={{ colorScheme: "dark" }}
          />
        </label>
        <label className="flex items-center gap-2 self-center pt-5 text-body-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          종일
        </label>
        <label className={`flex flex-col gap-1 text-body-sm ${allDay ? "opacity-40" : ""}`}>
          시작 시각
          <input
            type="time"
            value={time}
            disabled={allDay}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-body-sm"
            style={{ colorScheme: "dark" }}
          />
        </label>
        <div className={`flex flex-col gap-1 text-body-sm ${allDay ? "opacity-40" : ""}`}>
          소요 시간
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              disabled={allDay}
              onChange={(e) => setHours(e.target.value)}
              aria-label="시간"
              className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-body-sm tabular-nums"
            />
            시간
            <input
              type="number"
              min={0}
              max={59}
              step={10}
              value={mins}
              disabled={allDay}
              onChange={(e) => setMins(e.target.value)}
              aria-label="분"
              className="ml-1 w-16 rounded-lg border border-border bg-background px-3 py-2 text-body-sm tabular-nums"
            />
            분
          </div>
        </div>
        {!allDay && time && minutes ? (
          <span className="self-center pt-5 text-body-sm text-muted tabular-nums">
            {time} ~ {addMinutes(time, minutes)}
          </span>
        ) : null}
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-body-sm">
          메모 (고객에게 안 보임)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: OO회사 확정"
            className="rounded-lg border border-border bg-background px-3 py-2 text-body-sm"
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          마감으로 표시
        </button>
      </div>
      {message && <p className="mt-2 text-body-sm text-muted">{message}</p>}

      {closures.length === 0 ? (
        <p className="mt-4 text-body-sm text-muted">앞으로 막아 둔 일정이 없습니다.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border/50">
          {closures.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2 text-body-sm">
              <span className="w-36 font-semibold">
                {c.date} ({dayOf(c.date)})
              </span>
              <span className="w-48 tabular-nums">
                {c.start_time
                  ? `${c.start_time} ~ ${addMinutes(c.start_time, c.minutes ?? BASE_MINUTES)} (${durationLabel(c.minutes ?? BASE_MINUTES)})`
                  : "종일"}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">{c.note ?? ""}</span>
              <button
                type="button"
                onClick={() => remove(c.id)}
                onBlur={() => setArmed(null)}
                disabled={pending}
                className={`rounded-lg border px-3 py-1 text-micro ${
                  armed === c.id ? "border-danger text-danger" : "border-border text-muted hover:text-foreground"
                }`}
              >
                {armed === c.id ? "한 번 더 누르면 해제" : "해제"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
