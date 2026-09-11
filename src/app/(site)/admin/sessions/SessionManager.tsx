"use client";

import { useState, useTransition } from "react";
import type { Theme, SessionView } from "@/types/catalog";
import type { ActionResult } from "@/lib/adminGuard";
import { defaultMinAge } from "@/types/catalog";
import {
  createSessions,
  updateSessionStatus,
  updateSessionMinAge,
  deleteSession,
} from "./actions";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";

const WEEKDAYS = [
  { v: 0, label: "일" }, { v: 1, label: "월" }, { v: 2, label: "화" },
  { v: 3, label: "수" }, { v: 4, label: "목" }, { v: 5, label: "금" }, { v: 6, label: "토" },
];

const fmtKst = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit", day: "2-digit", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));

export function SessionManager({
  sessions,
  themes,
}: {
  sessions: SessionView[];
  themes: Theme[];
}) {
  const activeThemes = themes.filter((t) => t.is_active);

  const [themeId, setThemeId] = useState(activeThemes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [times, setTimes] = useState<string[]>(["11:30", "15:30", "19:30"]);
  const [weekdays, setWeekdays] = useState<number[]>([6, 0]); // 토·일
  const [weeks, setWeeks] = useState(4);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const theme = themes.find((t) => t.id === themeId);

  function submit() {
    startTransition(async () => {
      const res = await createSessions({
        theme_id: themeId,
        start_date: startDate,
        times: times.filter(Boolean),
        weekdays,
        weeks,
        admin_note: note,
      });
      if ("error" in res) setMessage({ kind: "err", text: res.error });
      else setMessage({ kind: "ok", text: res.message ?? "생성되었습니다." });
    });
  }

  function act(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setMessage({ kind: "err", text: res.error });
      else setMessage({ kind: "ok", text: "적용되었습니다." });
    });
  }

  if (activeThemes.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
        신청 가능한 테마가 없습니다. <strong>테마</strong> 메뉴에서 먼저 등록해주세요.
      </div>
    );
  }

  // 몇 개가 만들어질지 미리 보여준다 (실수 방지)
  const estimated =
    weekdays.length === 0
      ? times.filter(Boolean).length
      : weekdays.length * weeks * times.filter(Boolean).length;

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.kind === "ok" ? "border-glow text-glow" : "border-red-500 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ── 회차 열기 ── */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold">회차 열기</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={label}>테마 *</label>
            <select className={field} value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              {activeThemes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>시작일 *</label>
            <input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={label}>반복 주 수</label>
            <input
              type="number" min={1} max={26} className={field}
              value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className={label}>반복 요일 (아무것도 고르지 않으면 시작일 하루만)</label>
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.v}
                onClick={() =>
                  setWeekdays((cur) =>
                    cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]
                  )
                }
                className={`h-9 w-9 rounded text-sm ${
                  weekdays.includes(d.v)
                    ? "bg-glow text-glow-foreground"
                    : "border border-border text-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>하루 회차 시각</label>
          <div className="flex flex-wrap gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="time"
                  className="rounded border border-border bg-background px-2 py-2 text-sm"
                  value={t}
                  onChange={(e) => {
                    const next = [...times];
                    next[i] = e.target.value;
                    setTimes(next);
                  }}
                />
                <button
                  onClick={() => setTimes(times.filter((_, x) => x !== i))}
                  className="rounded border border-red-500/50 px-2 py-2 text-xs text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => setTimes([...times, "11:30"])}
              className="rounded border border-border px-3 py-2 text-xs"
            >
              + 시각 추가
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            최소 연령은 시각에 따라 자동으로 정해집니다 —{" "}
            <strong>18시 이전 만 16세 / 18시 이후 만 19세</strong>
            {theme?.min_age_floor ? ` (이 테마는 최소 ${theme.min_age_floor}세)` : ""}.
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
            {times.filter(Boolean).map((t, i) => (
              <span key={i} className="rounded bg-muted/15 px-2 py-0.5 text-muted">
                {t} → 만 {defaultMinAge(Number(t.split(":")[0]), theme?.min_age_floor)}세
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>메모 (운영자용)</label>
          <input className={field} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={pending || !startDate}
            className="rounded bg-glow px-4 py-2 text-sm text-glow-foreground disabled:opacity-50"
          >
            {pending ? "생성 중…" : `회차 ${estimated}개 만들기`}
          </button>
          <span className="text-xs text-muted">
            이미 같은 시각의 회차가 있으면 건너뜁니다.
          </span>
        </div>
      </div>

      {/* ── 목록 ── */}
      <div className="space-y-2">
        <h2 className="font-semibold">회차 목록 ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">등록된 회차가 없습니다.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {fmtKst(s.start_at)}
                  <span className="ml-2 text-muted">{s.theme_name}</span>
                  {s.legacy_format && (
                    <span className="ml-2 rounded bg-muted/20 px-1.5 py-0.5 text-[11px] text-muted">
                      과거 {s.legacy_format}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  만 {s.min_age}세 이상 · 확정선 {s.capacity_confirm_line} / 정원 {s.capacity_max}
                  {" · "}
                  {s.status === "open" ? "모집중" : s.status === "closed" ? "마감" : "비활성화"}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <select
                  className="rounded border border-border bg-background px-2 py-1.5 text-xs"
                  value={s.min_age}
                  onChange={(e) => act(() => updateSessionMinAge(s.id, Number(e.target.value)))}
                  disabled={pending}
                  title="최소 연령"
                >
                  {[14, 16, 19].map((a) => (
                    <option key={a} value={a}>만 {a}세</option>
                  ))}
                </select>

                {s.status !== "cancelled" && (
                  <button
                    onClick={() =>
                      act(() => updateSessionStatus(s.id, s.status === "open" ? "closed" : "open"))
                    }
                    disabled={pending}
                    className="rounded border border-border px-3 py-1.5 text-xs"
                  >
                    {s.status === "open" ? "마감하기" : "다시 열기"}
                  </button>
                )}

                <button
                  onClick={() => {
                    if (confirm(`${fmtKst(s.start_at)} 회차를 삭제할까요?`)) {
                      act(() => deleteSession(s.id));
                    }
                  }}
                  disabled={pending}
                  className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
