"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SessionView, ThemePriceTier } from "@/types/catalog";
import { resolveUnitPrice } from "@/types/catalog";
import { formatKrw } from "@/lib/format";
import type { SessionStats } from "@/types/domain";

export type PickerSession = SessionView & {
  stats: SessionStats | null;
  remaining: number | null;
  bookable: boolean;
};

const kstDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));

const kstDayLabel = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));

const kstTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

/**
 * 테마 상세 안에서 날짜 → 시각을 고르는 UI.
 *
 * 회차마다 별도 페이지를 만들지 않는 이유: 내용이 거의 같은 페이지가 매주
 * 늘어나면 검색엔진이 중복으로 판단한다. 페이지를 하나로 모으면 그 URL 에
 * SEO 점수가 누적된다. 특정 날짜 딥링크는 ?d=YYYY-MM-DD 로 처리한다.
 * 설계 근거: docs/08-architecture-screens-and-admin.md §1-2
 */
export function SessionPicker({
  themeSlug,
  sessions,
  tiers,
  accentColor,
}: {
  themeSlug: string;
  sessions: PickerSession[];
  tiers: ThemePriceTier[];
  accentColor: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // 날짜별로 묶는다 (하루에 여러 회차가 있으므로).
  const byDate = useMemo(() => {
    const map = new Map<string, PickerSession[]>();
    for (const s of sessions) {
      const d = kstDate(s.start_at);
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    return map;
  }, [sessions]);

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);

  const initialDate = (() => {
    const q = params.get("d");
    if (q && byDate.has(q)) return q;
    // 신청 가능한 회차가 있는 첫 날짜를 기본 선택
    return dates.find((d) => byDate.get(d)!.some((s) => s.bookable)) ?? dates[0] ?? "";
  })();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const daySessions = byDate.get(selectedDate) ?? [];
  const selected = daySessions.find((s) => s.id === selectedId) ?? null;

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-white/15 bg-white/5 p-8 text-center">
        <p className="font-semibold">현재 예정된 회차가 없습니다.</p>
        <p className="mt-2 text-sm text-muted">
          새 일정이 열리면 공지와 인스타그램으로 안내드립니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 날짜 ── */}
      <div>
        <p className="mb-2 text-sm font-semibold">1. 날짜 선택</p>
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => {
            const list = byDate.get(d)!;
            const anyOpen = list.some((s) => s.bookable);
            const isActive = d === selectedDate;
            return (
              <button
                key={d}
                onClick={() => {
                  setSelectedDate(d);
                  setSelectedId(null);
                  const next = new URLSearchParams(params.toString());
                  next.set("d", d);
                  router.replace(`/themes/${themeSlug}?${next.toString()}`, { scroll: false });
                }}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-transparent font-semibold"
                    : anyOpen
                      ? "border-white/20 hover:border-white/40"
                      : "border-white/10 text-muted"
                }`}
                style={isActive ? { backgroundColor: accentColor, color: "#0a0a12" } : undefined}
              >
                {kstDayLabel(list[0].start_at)}
                {!anyOpen && <span className="ml-1 text-xs">마감</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 시간 ── */}
      <div>
        <p className="mb-2 text-sm font-semibold">2. 시간 선택</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {daySessions.map((s) => {
            const isActive = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                disabled={!s.bookable}
                className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isActive ? "border-transparent" : "border-white/20 hover:border-white/40"
                }`}
                style={isActive ? { backgroundColor: accentColor, color: "#0a0a12" } : undefined}
              >
                <p className="text-base font-bold">{kstTime(s.start_at)}</p>
                <p className={`mt-0.5 text-xs ${isActive ? "opacity-80" : "text-muted"}`}>
                  만 {s.min_age}세 이상
                </p>
                <p className={`mt-1 text-xs ${isActive ? "opacity-80" : "text-muted"}`}>
                  {!s.bookable
                    ? "마감"
                    : s.remaining === null
                      ? ""
                      : s.remaining <= 5
                        ? `잔여 ${s.remaining}석`
                        : "예약 가능"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 요금 안내 ── */}
      {tiers.length > 0 && (
        <div className="rounded-lg border border-white/15 bg-white/5 p-4">
          <p className="mb-2 text-sm font-semibold">인원별 참가비 (1인 기준)</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[1, 2, 3, 4].map((n) => {
              const unit = resolveUnitPrice(tiers, n);
              if (unit === null) return null;
              return (
                <span key={n} className="text-muted">
                  {n}인 <strong className="text-foreground">{formatKrw(unit)}</strong>
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            인원이 많을수록 1인당 참가비가 저렴해집니다.
          </p>
        </div>
      )}

      {/* ── CTA ── */}
      <div>
        {selected ? (
          <a
            href={`/themes/${themeSlug}/apply?session=${selected.id}`}
            className="block rounded-lg px-6 py-4 text-center text-base font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: accentColor, color: "#0a0a12" }}
          >
            {kstDayLabel(selected.start_at)} {kstTime(selected.start_at)} 신청하기
          </a>
        ) : (
          <button
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-white/15 px-6 py-4 text-center text-base font-bold text-muted"
          >
            날짜와 시간을 선택해주세요
          </button>
        )}
      </div>
    </div>
  );
}
