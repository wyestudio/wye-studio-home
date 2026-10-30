"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { INQUIRY_STATUSES } from "@/lib/groupBooking";
import { addMinutes } from "@/lib/groupPricing";
import { saveInquiryStatus } from "./actions";

/** 확정 일시 — 이 신청 건으로 막아 둔 마감 구간. */
export type Booking = { date: string; time: string; minutes: number };

/**
 * 문의 한 건의 상태·메모 칸.
 *
 * 저장은 눌러야 된다 — 상태를 고르는 순간 저장되게 하면, 목록을 훑다가 잘못 건드린
 * 것도 그대로 기록된다(되돌릴 방법이 없다).
 *
 * '예약 확정' 을 고르면 확정 일시 칸이 열린다. 저장하면 그 구간이 마감으로 걸린다
 * (saveInquiryStatus). 처음 값은 희망 일시 · 견적 시간이지만, 다른 시간으로 안내해
 * 확정했으면 여기서 고쳐 넣는다(2026-10-30 대표님).
 */
export function InquiryRow({
  id,
  status: initialStatus,
  memo: initialMemo,
  booking: initialBooking,
  suggested,
}: {
  id: string;
  status: string;
  memo: string;
  /** 이미 확정해 마감을 걸어 둔 일시. 없으면 null. */
  booking: Booking | null;
  /** 확정 칸의 처음 값 — 희망 일시와 견적 시간(프로그램 + 애프터파티). */
  suggested: { date: string; time: string; minutes: number };
}) {
  const start = initialBooking ?? suggested;
  const [status, setStatus] = useState(initialStatus);
  const [memo, setMemo] = useState(initialMemo);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [hours, setHours] = useState(String(Math.floor(start.minutes / 60)));
  const [mins, setMins] = useState(String(start.minutes % 60));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  // 이미 확정해 둔 건은 한 줄로 접어 둔다 — 칸을 늘 펼쳐 두면 한 건이 너무 길어진다(2026-10-30 대표님).
  const [editing, setEditing] = useState(!initialBooking);

  const booked = status === "booked";
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0);
  const bookingChanged =
    booked &&
    (!initialBooking || initialBooking.date !== date || initialBooking.time !== time || initialBooking.minutes !== minutes);
  const dirty = status !== initialStatus || memo !== initialMemo || bookingChanged;

  function save() {
    startTransition(async () => {
      const res = await saveInquiryStatus({
        id,
        status,
        memo,
        booking: booked ? { date, time: time || null, minutes: minutes || null } : null,
      });
      setMessage("error" in res ? res.error : (res.message ?? "저장했습니다."));
      if (!("error" in res)) setEditing(false);
    });
  }

  const field = "rounded-lg border border-border bg-panel px-2 py-1.5 text-input tabular-nums";

  return (
    <div className="flex flex-col gap-2 md:min-w-[260px]">
      <Select
        value={status}
        onChange={setStatus}
        options={INQUIRY_STATUSES.map((s) => ({ value: s.code, label: s.label }))}
      />
      {booked && initialBooking && !editing && (
        <div className="flex items-center gap-2 text-body-sm">
          <span className="min-w-0 flex-1 text-muted tabular-nums">
            {initialBooking.date.slice(5)} {initialBooking.time} ~ {addMinutes(initialBooking.time, initialBooking.minutes)}{" "}
            마감 중
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-muted hover:text-foreground"
          >
            고치기
          </button>
        </div>
      )}
      {booked && editing && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2 text-body-sm">
          <span className="flex justify-between gap-2 font-semibold">
            확정 일시
            {time && minutes > 0 && (
              <span className="font-normal text-muted tabular-nums">
                {time} ~ {addMinutes(time, minutes)} 마감
              </span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="확정 날짜"
              className={field}
              style={{ colorScheme: "dark" }}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="확정 시작 시각"
              className={field}
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-label="소요 시간(시간)"
              className={`${field} w-14`}
            />
            시간
            <input
              type="number"
              min={0}
              max={59}
              step={10}
              value={mins}
              onChange={(e) => setMins(e.target.value)}
              aria-label="소요 시간(분)"
              className={`${field} ml-1 w-14`}
            />
            분
          </div>
        </div>
      )}
      {!booked && initialBooking && (
        <p className="text-body-sm text-muted">저장하면 확정 일시 마감({initialBooking.date} {initialBooking.time})이 풀려요.</p>
      )}
      <textarea
        rows={2}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="응대 메모"
        className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-input outline-none focus:border-glow"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-lg bg-brand px-4 py-2 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {message && <span className="text-body-sm text-muted">{message}</span>}
      </div>
    </div>
  );
}
