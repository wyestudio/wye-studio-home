"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { CopyUrlButton } from "@/components/admin/CopyUrlButton";
import { formatDateFull, formatDateTimeFull } from "@/lib/format";
import { SessionStatusToggle } from "@/components/admin/SessionStatusToggle";

const ACCENT = "#3dffb0";

export type DashboardSession = {
  id: string;
  theme_id: string | null;
  start_at: string;
  status: string;
  /** 이 시각부터 고객 화면에 보인다. 미래면 아직 비공개. */
  opens_at: string | null;
  theme_name: string | null;
  format_label: string | null;
  capacity_line: string;
  headcount_line: string;
  unpaid: number;
  public_path: string | null;
};

export type DashboardTheme = { id: string; name: string };

const kstYmd = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));

const kstTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));

const kstDateLabel = (ymd: string) => formatDateFull(`${ymd}T12:00:00+09:00`);

/**
 * 대시보드 회차 보기.
 *
 * 롤링 오픈으로 회차가 몇 백 개가 되면 목록으로는 못 본다.
 * 테마를 고르고 달력에서 날짜를 눌러 그 날의 회차만 본다.
 */
export function DashboardSessions({
  themes,
  sessions,
  siteUrl,
  nowMs,
}: {
  themes: DashboardTheme[];
  sessions: DashboardSession[];
  siteUrl: string;
  /** 서버 렌더 시각. '공개 예정' 판정 기준 — 렌더 중 Date.now() 를 부르지 않는다. */
  nowMs: number;
}) {
  // 테마에 안 붙은 옛 회차도 볼 수 있게 마지막 탭을 둔다.
  const hasLegacy = sessions.some((s) => !s.theme_id);
  const tabs: DashboardTheme[] = hasLegacy
    ? [...themes, { id: "__legacy__", name: "과거 회차" }]
    : themes;

  const [themeId, setThemeId] = useState(tabs[0]?.id ?? "");

  const mine = useMemo(
    () =>
      sessions.filter((s) =>
        themeId === "__legacy__" ? !s.theme_id : s.theme_id === themeId
      ),
    [sessions, themeId]
  );

  const dateStatus = useMemo(() => {
    const map = new Map<string, { hasOpen: boolean }>();
    for (const s of mine) {
      const d = kstYmd(s.start_at);
      const open = s.status !== "cancelled" && (!s.opens_at || new Date(s.opens_at).getTime() <= nowMs);
      map.set(d, { hasOpen: (map.get(d)?.hasOpen ?? false) || open });
    }
    return map;
  }, [mine, nowMs]);

  // 오늘 이후 가장 가까운 회차 날짜를 기본으로 연다.
  const initialDate = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(nowMs));
    const days = [...dateStatus.keys()].sort();
    return days.find((d) => d >= today) ?? days[days.length - 1] ?? "";
  }, [dateStatus, nowMs]);

  const [selected, setSelected] = useState("");
  const date = selected || initialDate;

  const daySessions = mine
    .filter((s) => kstYmd(s.start_at) === date)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  if (tabs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        등록된 테마가 없습니다. <Link href="/themes" className="underline">테마 등록</Link>
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setThemeId(t.id); setSelected(""); }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              themeId === t.id
                ? "bg-glow text-glow-foreground"
                : "border border-border text-muted hover:border-glow"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {dateStatus.size === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted">
          이 테마에 등록된 회차가 없습니다.{" "}
          <Link href="/sessions" className="underline">회차 편성</Link>에서 일정을 정해주세요.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div>
            <BookingCalendar
              dateStatus={dateStatus}
              selected={date}
              accentColor={ACCENT}
              openingDate={null}
              onSelect={setSelected}
            />
            <p className="mt-2 text-[11px] text-muted">
              점이 흐린 날은 아직 공개 전인 회차만 있는 날입니다.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              {date ? kstDateLabel(date) : "날짜를 선택해주세요"}
              <span className="ml-2 font-normal text-muted">{daySessions.length}회차</span>
            </h3>

            {daySessions.length === 0 ? (
              <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">
                이 날짜에는 회차가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {daySessions.map((s) => {
                  const pending = s.opens_at != null && new Date(s.opens_at).getTime() > nowMs;
                  return (
                    <div key={s.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {kstTime(s.start_at)}
                            {s.format_label && (
                              <span className="ml-2 rounded bg-muted/20 px-1.5 py-0.5 text-[11px] font-normal text-muted">
                                {s.format_label}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-muted">{s.capacity_line}</p>
                          <p className="mt-1 text-xs text-muted">{s.headcount_line}</p>
                          <p className="mt-1 text-xs text-muted">입금 확인 전 인원: {s.unpaid}명</p>
                          {pending && s.opens_at && (
                            <p className="mt-1 text-xs text-amber-400">
                              공개 예정: {formatDateTimeFull(s.opens_at)}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-sm font-medium">
                            {s.status === "cancelled" ? (
                              <span className="text-red-500">비활성화</span>
                            ) : pending ? (
                              <span className="text-amber-400">공개 전</span>
                            ) : (
                              <span className="text-glow">{s.status === "open" ? "모집중" : "마감"}</span>
                            )}
                          </span>
                          {s.public_path && <CopyUrlButton url={`${siteUrl}${s.public_path}`} />}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/sessions/${s.id}`}
                          className="rounded border border-border px-3 py-1.5 text-xs hover:border-glow"
                        >
                          신청자 보기 →
                        </Link>
                        <SessionStatusToggle
                          sessionId={s.id}
                          status={s.status}
                          label={`${kstDateLabel(date)} ${kstTime(s.start_at)}`}
                          size="md"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
