"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { addGroupClosure, removeGroupClosure } from "./actions";

type Closure = { id: string; date: string; start_time: string | null; note: string | null };

const TIME_OPTIONS = [
  { value: "", label: "종일" },
  { value: "11:30", label: "11:30 회차" },
  { value: "15:30", label: "15:30 회차" },
  { value: "19:30", label: "19:30 회차" },
];

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
const dayOf = (d: string) => DAY[new Date(`${d}T00:00:00Z`).getUTCDay()];

/**
 * 단체 일정 마감 표시.
 *
 * 견적 화면(/group)의 달력·회차에 '마감' 으로 뜨고, 그 일정으로는 접수가 안 된다.
 * 평일은 시간을 자유롭게 받으므로 **종일**로만 막을 수 있다. 회차(11:30 등)는 주말용이다.
 *
 * 해제는 두 번 눌러야 된다 — 목록을 훑다 잘못 누르면 막아 둔 날이 바로 열린다.
 */
export function ClosureManager({ closures }: { closures: Closure[] }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!date) return setMessage("날짜를 고르세요.");
    startTransition(async () => {
      const res = await addGroupClosure({ date, time: time || null, note });
      setMessage("error" in res ? res.error : (res.message ?? "저장했습니다."));
      if (!("error" in res)) setNote("");
    });
  }

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
        견적 화면에서 고를 수 없게 막습니다. 평일은 종일로만 막을 수 있어요(평일은 시간을 자유롭게 받습니다).
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
        <div className="flex w-36 flex-col gap-1 text-body-sm">
          회차
          <Select value={time} onChange={setTime} options={TIME_OPTIONS} />
        </div>
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
              <span className="w-20">{c.start_time ?? "종일"}</span>
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
