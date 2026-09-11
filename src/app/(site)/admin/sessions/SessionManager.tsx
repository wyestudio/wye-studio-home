"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { Theme } from "@/types/catalog";
import { defaultMinAge } from "@/types/catalog";
import { nextOpening, todayKst } from "@/lib/scheduleRules";
import { saveSchedule, type ScheduleInput } from "./actions";

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";

/** 행성 로고를 안 올린 테마가 쓰는 기본 그림. 고객 화면과 같은 규칙. */
const FALLBACK_LOGO = "/logo-white.png";

const WEEKDAYS = [
  { v: 0, label: "일" }, { v: 1, label: "월" }, { v: 2, label: "화" },
  { v: 3, label: "수" }, { v: 4, label: "목" }, { v: 5, label: "금" }, { v: 6, label: "토" },
];

export type ThemeSchedule = {
  theme_id: string;
  start_date: string;
  end_date: string | null;
  weekdays: number[];
  times: string[];
  open_weeks_before: number;
  open_weekday: number;
  open_time: string;
  generated_until: string | null;
};

const fmtOpensAt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));

const fmtDate = (ymd: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long", day: "numeric", weekday: "short",
  }).format(new Date(`${ymd}T12:00:00+09:00`));

function blankSchedule(themeId: string): ScheduleInput {
  return {
    theme_id: themeId,
    start_date: todayKst(),
    end_date: null,
    weekdays: [6, 0],
    times: ["11:30", "15:30", "19:30"],
    open_weeks_before: 3,
    open_weekday: 6,
    open_time: "00:00",
  };
}

/**
 * 회차 편성.
 *
 * 회차를 한 건씩 만들지 않는다. 매주 같은 요일·같은 시각으로 계속 돌리고,
 * 일정은 3주 전처럼 정해진 시점에 하나씩 열리게 한다.
 *
 * 회차 '목록' 은 여기 두지 않는다 — 대시보드에서 날짜로 본다.
 */
export function SessionManager({
  themes,
  schedules,
}: {
  themes: Theme[];
  schedules: ThemeSchedule[];
}) {
  const [themeId, setThemeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const theme = themes.find((t) => t.id === themeId) ?? null;
  const saved = schedules.find((s) => s.theme_id === themeId) ?? null;

  function open(t: Theme) {
    const s = schedules.find((x) => x.theme_id === t.id);
    setThemeId(t.id);
    setMessage(null);
    setDraft(
      s
        ? {
            theme_id: t.id,
            start_date: s.start_date,
            end_date: s.end_date,
            weekdays: s.weekdays,
            times: s.times,
            open_weeks_before: s.open_weeks_before,
            open_weekday: s.open_weekday,
            // DB time 은 'HH:MM:SS' 로 온다. input[type=time] 은 HH:MM 만 받는다.
            open_time: s.open_time.slice(0, 5),
          }
        : blankSchedule(t.id)
    );
  }

  function patch(p: Partial<ScheduleInput>) {
    setDraft((cur) => (cur ? { ...cur, ...p } : cur));
  }

  function submit() {
    if (!draft) return;
    startTransition(async () => {
      const res = await saveSchedule(draft);
      if ("error" in res) setMessage({ kind: "err", text: res.error });
      else setMessage({ kind: "ok", text: res.message ?? "저장되었습니다." });
    });
  }

  if (themes.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted">
        등록된 테마가 없습니다. <strong>테마</strong> 메뉴에서 먼저 등록해주세요.
      </div>
    );
  }

  // ── 테마 고르기 ──────────────────────────────────────────
  if (!theme || !draft) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {themes.map((t) => {
          const s = schedules.find((x) => x.theme_id === t.id);
          return (
            <button
              key={t.id}
              onClick={() => open(t)}
              className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-glow"
            >
              <div className="relative aspect-square bg-background">
                <Image
                  src={t.logo_image_path || FALLBACK_LOGO}
                  alt={t.name}
                  fill
                  className="object-contain p-3"
                  sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                />
              </div>
              <div className="border-t border-border p-3">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {s
                    ? `${s.weekdays.map((w) => WEEKDAYS[w].label).join("·")} · ${s.times.length}회차`
                    : "편성 없음"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── 편성 편집 ────────────────────────────────────────────
  const times = draft.times.filter(Boolean);
  const next = times.length > 0 && draft.weekdays.length > 0
    ? nextOpening({ ...draft, times })
    : null;

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.kind === "ok" ? "border-glow text-glow" : "border-red-500 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => { setThemeId(null); setDraft(null); }}
          className="rounded border border-border px-3 py-1.5 text-xs"
        >
          ← 테마 목록
        </button>
        <h2 className="font-semibold">{theme.name} 편성</h2>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold">언제 진행하나</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>시작일 *</label>
            <input
              type="date" className={field}
              value={draft.start_date}
              onChange={(e) => patch({ start_date: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-muted">이 날짜부터 반복합니다. 지난 날짜는 만들지 않습니다.</p>
          </div>
          <div>
            <label className={label}>종료일</label>
            <input
              type="date" className={field}
              value={draft.end_date ?? ""}
              onChange={(e) => patch({ end_date: e.target.value || null })}
            />
            <p className="mt-1 text-[11px] text-muted">
              이 날짜까지만 만듭니다. <strong>비우면 계속 반복</strong>합니다.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>반복 요일 *</label>
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() =>
                    patch({
                      weekdays: draft.weekdays.includes(d.v)
                        ? draft.weekdays.filter((x) => x !== d.v)
                        : [...draft.weekdays, d.v].sort(),
                    })
                  }
                  className={`h-9 w-9 rounded text-sm ${
                    draft.weekdays.includes(d.v)
                      ? "bg-glow text-glow-foreground"
                      : "border border-border text-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className={label}>회차 시각 *</label>
          <div className="flex flex-wrap gap-2">
            {draft.times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="time"
                  className="rounded border border-border bg-background px-2 py-2 text-sm"
                  value={t}
                  onChange={(e) => {
                    const next = [...draft.times];
                    next[i] = e.target.value;
                    patch({ times: next });
                  }}
                />
                <button
                  type="button"
                  onClick={() => patch({ times: draft.times.filter((_, x) => x !== i) })}
                  className="rounded border border-red-500/50 px-2 py-2 text-xs text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => patch({ times: [...draft.times, "11:30"] })}
              className="rounded border border-border px-3 py-2 text-xs"
            >
              + 시각 추가
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {times.map((t, i) => (
              <span key={i} className="rounded bg-muted/15 px-2 py-0.5 text-muted">
                {t} → 만 {defaultMinAge(Number(t.split(":")[0]), theme.min_age_floor)}세 이상
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            최소 연령은 시각으로 자동 결정됩니다 — <strong>18시 이전 만 16세 / 이후 만 19세</strong>
            {theme.min_age_floor ? ` (이 테마는 최소 ${theme.min_age_floor}세)` : ""}.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold">언제 신청을 여나</h3>
        <p className="text-xs text-muted">
          일정을 한꺼번에 다 열지 않고, 회차일이 가까워지면 하나씩 엽니다.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className={label}>몇 주 전</label>
            <input
              type="number" min={0} max={52} className={field}
              value={draft.open_weeks_before}
              onChange={(e) => patch({ open_weeks_before: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={label}>요일</label>
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => patch({ open_weekday: d.v })}
                  className={`h-9 w-9 rounded text-sm ${
                    draft.open_weekday === d.v
                      ? "bg-glow text-glow-foreground"
                      : "border border-border text-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-32">
            <label className={label}>시각</label>
            <input
              type="time" className={field}
              value={draft.open_time}
              onChange={(e) => patch({ open_time: e.target.value })}
            />
          </div>
        </div>

        {/* 규칙이 의도대로 걸렸는지는 말보다 실제 날짜를 보여주는 게 빠르다. */}
        <div className="rounded bg-muted/10 p-3 text-xs">
          {next ? (
            <>
              <p className="font-medium">
                다음 공개: <span className="text-glow">{fmtOpensAt(next.opensAt)}</span>
              </p>
              <p className="mt-1 text-muted">
                이때 {next.dates.map(fmtDate).join(" · ")} 회차가 신청 가능으로 바뀝니다.
              </p>
            </>
          ) : (
            <p className="text-muted">요일과 시각을 정하면 다음 공개 시점을 보여드립니다.</p>
          )}
        </div>
      </div>

      {saved?.generated_until && (
        <p className="text-xs text-muted">
          현재 <strong className="text-foreground">{saved.generated_until}</strong>까지 회차가 만들어져 있습니다.
          기간이 다 되기 전에 이 화면에서 다시 저장하면 연장됩니다.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={submit}
          disabled={pending}
          className="rounded bg-glow px-4 py-2 text-sm text-glow-foreground disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장하고 회차 만들기"}
        </button>
        <span className="text-xs text-muted">
          이미 있는 회차는 그대로 둡니다. 신청이 붙어 있을 수 있어서요.
        </span>
      </div>
    </div>
  );
}
