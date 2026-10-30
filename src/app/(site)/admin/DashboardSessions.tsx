"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyUrlButton } from "@/components/admin/CopyUrlButton";
import { formatDateFull, formatDateTimeFull } from "@/lib/format";
import { SessionStatusToggle } from "@/components/admin/SessionStatusToggle";
import { SessionBadgeToggle } from "@/components/admin/SessionBadgeToggle";
import { GroupBlockToggle } from "@/components/admin/GroupBlockToggle";
import { Chevron } from "@/components/ui/Chevron";
import { inquiryStatusLabel } from "@/lib/groupBooking";
import { BASE_MINUTES, addMinutes } from "@/lib/groupPricing";
import { addGroupClosure, removeGroupClosure } from "./group-bookings/actions";

export type DashboardSession = {
  id: string;
  theme_id: string | null;
  start_at: string;
  status: string;
  /** 이 시각부터 고객 화면에 보인다. 미래면 아직 비공개. */
  opens_at: string | null;
  theme_name: string | null;
  format_label: string | null;
  /** 파티모드/노말모드. 모드가 없는 테마는 null. */
  theme_mode?: string | null;
  headcount_line: string;
  /** 확정 인원(달력 칸의 짧은 표시용). */
  confirmed: number;
  /** 예약 인원(취소 제외) — 노말모드 카드에 쓴다. */
  booked_people: number;
  /** 노말모드 예약의 입금 상태. 예약이 없으면 null. */
  payment_label: string | null;
  unpaid: number;
  public_path: string | null;
  /** 고객 화면 시각 옆에 붙는 표시(예: 인기). 비우면 안 붙는다. */
  badge: string | null;
  /** 「단체 막기」 상태. 단체 예약을 받는 테마(파티모드)의 회차가 아니면 null — 버튼을 안 띄운다. */
  group_block: boolean | null;
};

/** 단체 견적 신청 한 건 — 확정이면 확정 일시, 아니면 희망 일시로 달력에 놓인다. */
export type DashboardGroup = {
  id: string;
  name: string;
  headcount: number;
  status: string;
  preferred_date: string | null;
  /** 'HH:MM' 이 아닐 수 있다(v1 코드값). */
  preferred_time: string;
  /** 희망 구간의 길이(분) — 견적 시간. */
  minutes: number;
  booking: { date: string; time: string; minutes: number } | null;
};

/** 운영자가 직접 막은 일정(예약 확정 · 파티 회차에서 걸린 것은 그쪽에서 보인다). */
export type DashboardClosure = {
  id: string;
  date: string;
  start_time: string | null;
  minutes: number | null;
  note: string | null;
};

const COLOR = {
  party: "#3dffb0",
  normal: "#40ecff",
  other: "#9aa0b4",
  group: "#f082f4",
  block: "#ff6b6b",
} as const;

type Kind = "party" | "normal" | "other" | "group" | "inquiry" | "block";

/** 달력 칸 하나에 놓이는 것. 칸 안에서는 누를 수 없다 — 날짜만 고른다(2026-10-30 대표님, 잘못 눌러 넘어가는 게 거슬린다). */
type CalEvent = { key: string; date: string; time: string; kind: Kind; label: string };

const LEGEND: { kind: Kind; label: string }[] = [
  { kind: "party", label: "파티" },
  { kind: "normal", label: "노말" },
  { kind: "group", label: "단체 확정" },
  { kind: "inquiry", label: "단체 희망" },
  { kind: "block", label: "막음" },
];

const kindColor = (k: Kind) =>
  k === "inquiry" ? COLOR.group : k === "group" ? COLOR.group : k === "block" ? COLOR.block : COLOR[k];

const kstYmd = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));

const kstTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

const kstDateLabel = (ymd: string) => formatDateFull(`${ymd}T12:00:00+09:00`);

const HHMM = /^\d{2}:\d{2}$/;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** 아직 결론이 안 난 단체 문의 — 달력에 희망 일시로 흐리게 놓는다. */
const OPEN_INQUIRY = new Set(["new", "contacted", "quoted"]);

function sessionKind(s: DashboardSession): Kind {
  if (s.group_block !== null) return "party";
  if (s.theme_mode?.includes("노말")) return "normal";
  return "other";
}

/**
 * 대시보드 일정 달력 — 회차(파티 · 노말) · 단체 신청 · 막아 둔 일정을 한 달에 다 본다(2026-10-30 대표님).
 *
 * 칸에서는 날짜만 고른다. 그날 목록(컴퓨터는 오른쪽, 휴대폰은 아래)에서 회차 버튼(마감 · 인기 ·
 * 단체 막기) · 단체 신청 건 · 「이날 단체 막기」 를 다룬다. 칸에는 시각만 색으로 찍는다 —
 * 휴대폰은 그마저 좁아 색 점만.
 *
 * 마감 규칙 — 막는 길은 셋이고 모두 group_booking_closures 한 표에 모인다.
 *   단체 예약 확정 → 그 구간의 단체 · 회차를 막는다(단체 예약 문의에서 확정 일시를 넣을 때)
 *   파티 회차 「단체 막기」 → 그 회차 시간에 단체만 막는다
 *   「이날 단체 막기」 → 휴무 · 대관 불가처럼 회차와 상관없는 날
 *   노말 신청이 있는 회차 시간은 따로 막지 않아도 단체에서 자동으로 막힌다(public_group_busy_slots).
 */
export function DashboardSessions({
  sessions,
  groups,
  closures,
  siteUrl,
  nowMs,
}: {
  sessions: DashboardSession[];
  groups: DashboardGroup[];
  closures: DashboardClosure[];
  siteUrl: string;
  /** 서버 렌더 시각 — 렌더 중 Date.now() 를 부르지 않는다. */
  nowMs: number;
}) {
  const today = kstYmd(new Date(nowMs).toISOString());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  const events = useMemo(() => {
    const list: CalEvent[] = [];
    for (const s of sessions) {
      if (s.status === "cancelled") continue;
      const kind = sessionKind(s);
      const mode = kind === "party" ? "파티" : kind === "normal" ? "노말" : (s.theme_name ?? "회차");
      list.push({
        key: `s-${s.id}`,
        date: kstYmd(s.start_at),
        time: kstTime(s.start_at),
        kind,
        label: `${kstTime(s.start_at)} ${mode} ${s.confirmed}명`,
      });
    }
    for (const g of groups) {
      if (g.booking) {
        list.push({
          key: `g-${g.id}`,
          date: g.booking.date,
          time: g.booking.time,
          kind: "group",
          label: `${g.booking.time} 단체 ${g.name}`,
        });
      } else if (OPEN_INQUIRY.has(g.status) && g.preferred_date) {
        const t = HHMM.test(g.preferred_time) ? g.preferred_time : "";
        list.push({
          key: `g-${g.id}`,
          date: g.preferred_date,
          time: t || "99:99",
          kind: "inquiry",
          label: `${t ? `${t} ` : ""}희망 ${g.name}`,
        });
      }
    }
    for (const c of closures) {
      list.push({
        key: `c-${c.id}`,
        date: c.date,
        time: c.start_time ?? "00:00",
        kind: "block",
        label: c.start_time ? `${c.start_time} 막음` : "종일 막음",
      });
    }
    const byDate = new Map<string, CalEvent[]>();
    for (const e of list) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
    for (const arr of byDate.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return byDate;
  }, [sessions, groups, closures]);

  // 달력 칸: 그 달 1일이 있는 주의 일요일부터 6주.
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const weeks = cells[35].slice(0, 7) === month ? 6 : 5;
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  const daySessions = sessions
    .filter((s) => kstYmd(s.start_at) === selected)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const dayGroups = groups
    .filter((g) => (g.booking ? g.booking.date === selected : OPEN_INQUIRY.has(g.status) && g.preferred_date === selected))
    .sort((a, b) => (a.booking?.time ?? a.preferred_time).localeCompare(b.booking?.time ?? b.preferred_time));
  const dayClosures = closures.filter((c) => c.date === selected);

  return (
    // 컴퓨터는 달력 왼쪽 · 그날 목록 오른쪽 — 달력이 화면 폭을 다 쓰면 너무 크다(2026-10-30 대표님).
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* ── 달 ── */}
      <div className="rounded-xl border border-border p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="이전 달"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          >
            <Chevron dir="left" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold tabular-nums">
              {y}년 {m}월
            </span>
            {month !== today.slice(0, 7) && (
              <button
                type="button"
                onClick={() => {
                  setMonth(today.slice(0, 7));
                  setSelected(today);
                }}
                className="rounded-md border border-border px-2 py-1 text-micro text-muted hover:text-foreground"
              >
                오늘
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="다음 달"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          >
            <Chevron dir="right" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-micro text-muted">
          {DOW.map((d, i) => (
            <div key={d} className={`pb-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-sky-400" : ""}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border">
          {cells.slice(0, weeks * 7).map((d) => {
            const evs = events.get(d) ?? [];
            const inMonth = d.slice(0, 7) === month;
            const isSel = d === selected;
            const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(d)}
                aria-label={`${kstDateLabel(d)} ${evs.length}건`}
                aria-pressed={isSel}
                className={`flex min-h-14 cursor-pointer flex-col gap-1 p-1 text-left md:min-h-20 md:p-1.5 ${
                  isSel ? "bg-fill-strong" : "bg-background hover:bg-fill-subtle"
                } ${inMonth ? "" : "[&>*]:opacity-40"}`}
              >
                <span
                  className={`text-micro tabular-nums ${
                    d === today
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-glow font-semibold text-glow-foreground"
                      : dow === 0
                        ? "text-red-400"
                        : dow === 6
                          ? "text-sky-400"
                          : "text-muted"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                {/* 휴대폰: 색 점 */}
                <span className="flex flex-wrap gap-0.5 md:hidden">
                  {evs.slice(0, 6).map((e) => (
                    <span
                      key={e.key}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: kindColor(e.kind), opacity: e.kind === "inquiry" ? 0.45 : 1 }}
                    />
                  ))}
                </span>
                {/* 컴퓨터: 시각만 색으로 */}
                <span className="hidden flex-col gap-0.5 md:flex">
                  {evs.slice(0, 3).map((e) => (
                    <EventChip key={e.key} e={e} />
                  ))}
                  {evs.length > 3 && <span className="text-micro text-muted">+{evs.length - 3}</span>}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-micro text-muted">
          {LEGEND.map((l) => (
            <span key={l.kind} className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: kindColor(l.kind), opacity: l.kind === "inquiry" ? 0.45 : 1 }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── 고른 날 ── */}
      <div>
        <h3 className="mb-3 text-body font-semibold">{kstDateLabel(selected)}</h3>

        {daySessions.length === 0 && dayGroups.length === 0 && dayClosures.length === 0 && (
          <p className="mb-4 rounded-lg border border-border p-6 text-center text-body-sm text-muted">
            이날은 회차도 단체 일정도 없습니다.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {daySessions.map((s) => (
            <SessionCard key={s.id} s={s} date={selected} siteUrl={siteUrl} nowMs={nowMs} />
          ))}

          {dayGroups.map((g) => (
            <Link
              key={g.id}
              href={`/group-bookings?id=${g.id}#list`}
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-fill-subtle"
              style={{ borderColor: `${COLOR.group}${g.booking ? "99" : "40"}` }}
            >
              <span className="min-w-0 flex-1">
                <span className="font-semibold tabular-nums">
                  {g.booking
                    ? `${g.booking.time} ~ ${addMinutes(g.booking.time, g.booking.minutes)}`
                    : HHMM.test(g.preferred_time)
                      ? `${g.preferred_time} ~ ${addMinutes(g.preferred_time, g.minutes)}`
                      : "시간 미정"}
                </span>
                <span
                  className="ml-2 rounded-md px-1.5 py-0.5 text-micro"
                  style={{ backgroundColor: `${COLOR.group}26`, color: COLOR.group }}
                >
                  {g.booking ? "단체 확정" : `단체 희망 · ${inquiryStatusLabel(g.status)}`}
                </span>
                <span className="mt-1 block text-micro text-muted">
                  {g.name} · {g.headcount}명
                </span>
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          ))}

          {dayClosures.map((c) => (
            <ClosureRow key={c.id} c={c} />
          ))}

          {/* 날짜를 바꾸면 새로 그린다 — 안 그러면 다른 날 막은 결과 문구가 남아 헷갈린다. */}
          <DayBlockForm key={selected} date={selected} />
        </div>
      </div>
    </div>
  );
}

function EventChip({ e }: { e: CalEvent }) {
  const color = kindColor(e.kind);
  return (
    <span
      title={e.label}
      className="block truncate rounded px-1 text-micro leading-5 tabular-nums"
      style={{
        backgroundColor: `${color}${e.kind === "inquiry" ? "14" : "26"}`,
        color,
        // 테두리는 outline 으로 — border 는 폭을 먹어 좁은 칸에서 시각이 잘린다.
        ...(e.kind === "inquiry" ? { outline: `1px dashed ${color}66`, outlineOffset: "-1px" } : {}),
      }}
    >
      {/* 종일 막음만 글자로 — 나머지는 시각만 적는다(칸이 좁다). */}
      {e.kind === "block" && e.time === "00:00" ? "종일" : e.time === "99:99" ? "희망" : e.time}
    </span>
  );
}

function SessionCard({
  s,
  date,
  siteUrl,
  nowMs,
}: {
  s: DashboardSession;
  date: string;
  siteUrl: string;
  nowMs: number;
}) {
  const pending = s.opens_at != null && new Date(s.opens_at).getTime() > nowMs;
  const kind = sessionKind(s);
  const color = COLOR[kind as "party" | "normal" | "other"];
  // 상태는 시각 옆에 크게 — 오른쪽 끝에 두면 눈에 안 띈다(2026-10-30 대표님).
  const state =
    s.status === "cancelled"
      ? { label: "비활성화", cls: "bg-red-500 text-white" }
      : pending
        ? { label: "공개 전", cls: "bg-amber-400 text-black" }
        : s.status === "open"
          ? { label: "모집중", cls: "bg-glow text-black" }
          : { label: "마감", cls: "bg-zinc-500 text-white" };
  return (
    <div className="rounded-lg border border-border" style={{ borderLeft: `3px solid ${color}` }}>
      {/* 카드 윗부분을 누르면 회차 상세(신청자)로 — 단체 카드와 같은 모양 */}
      <Link href={`/sessions/${s.id}`} className="flex items-center gap-3 rounded-t-lg p-4 pb-3 hover:bg-fill-subtle">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-body font-semibold tabular-nums">{kstTime(s.start_at)}</span>
            {(s.theme_mode ?? s.format_label ?? s.theme_name) && (
              <span className="rounded-md bg-muted/20 px-1.5 py-0.5 text-micro text-muted">
                {s.theme_mode ?? s.format_label ?? s.theme_name}
              </span>
            )}
            {/* 꽉 찬 색 — 옅은 배경은 카드 배경에 묻혀 눈에 안 띄었다(2026-10-30 대표님). */}
            <span className={`rounded-md px-2 py-0.5 text-micro font-semibold ${state.cls}`}>{state.label}</span>
          </span>
          {kind === "normal" ? (
            // 노말은 한 팀만 받는다 — 확정 · 대기 대신 예약 인원과 입금 상태.
            <span className="mt-1 block text-micro text-muted">
              {s.booked_people > 0 ? `예약 ${s.booked_people}명 · ${s.payment_label}` : "예약 없음"}
            </span>
          ) : (
            <>
              <span className="mt-1 block text-micro text-muted">{s.headcount_line}</span>
              <span className="mt-0.5 block text-micro text-muted">입금 확인 전 인원: {s.unpaid}명</span>
            </>
          )}
          {pending && s.opens_at && (
            <span className="mt-0.5 block text-micro text-amber-400">공개 예정: {formatDateTimeFull(s.opens_at)}</span>
          )}
        </span>
        <Chevron className="h-4 w-4 shrink-0 text-muted" />
      </Link>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
        <SessionStatusToggle
          sessionId={s.id}
          status={s.status}
          label={`${kstDateLabel(date)} ${kstTime(s.start_at)}`}
          size="md"
        />
        {/* 마감·비활성화된 회차는 고객 화면에서 '마감' 이 이기므로 태그가 안 보인다. */}
        <SessionBadgeToggle sessionId={s.id} badge={s.badge} />
        {s.group_block !== null && <GroupBlockToggle sessionId={s.id} on={s.group_block} />}
        {s.public_path && (
          <span className="ml-auto">
            <CopyUrlButton url={`${siteUrl}${s.public_path}`} />
          </span>
        )}
      </div>
    </div>
  );
}

/** 직접 막은 일정 한 줄. 해제는 두 번 눌러야 된다 — 훑다 잘못 누르면 막아 둔 날이 바로 열린다. */
function ClosureRow({ c }: { c: DashboardClosure }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const remove = () => {
    if (!armed) return setArmed(true);
    startTransition(async () => {
      const res = await removeGroupClosure(c.id);
      if ("error" in res) return setError(res.error);
      router.refresh();
    });
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4" style={{ borderColor: `${COLOR.block}66` }}>
      <span className="min-w-0 flex-1">
        <span className="font-semibold tabular-nums">
          {c.start_time ? `${c.start_time} ~ ${addMinutes(c.start_time, c.minutes ?? BASE_MINUTES)}` : "종일"}
        </span>
        <span
          className="ml-2 rounded-md px-1.5 py-0.5 text-micro"
          style={{ backgroundColor: `${COLOR.block}26`, color: COLOR.block }}
        >
          단체 막음
        </span>
        {c.note && <span className="mt-1 block text-micro text-muted">{c.note}</span>}
        {error && <span className="mt-1 block text-micro text-red-400">{error}</span>}
      </span>
      <button
        type="button"
        onClick={remove}
        onBlur={() => setArmed(false)}
        disabled={pending}
        className={`shrink-0 rounded-lg border px-3 py-1.5 text-micro ${
          armed ? "border-danger text-danger" : "border-border text-muted hover:text-foreground"
        }`}
      >
        {pending ? "푸는 중…" : armed ? "한 번 더 누르면 해제" : "해제"}
      </button>
    </div>
  );
}

/**
 * 「이날 단체 막기」 — 휴무 · 대관 불가처럼 회차와 상관없이 단체를 못 받는 시간.
 * 겹치는 빈 회차(파티 · 노말)도 같이 닫힌다(addGroupClosure).
 */
function DayBlockForm({ date }: { date: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [time, setTime] = useState("");
  const [hours, setHours] = useState(String(BASE_MINUTES / 60));
  const [mins, setMins] = useState("0");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const minutes = (Number(hours) || 0) * 60 + (Number(mins) || 0) || null;

  const submit = () => {
    if (!allDay && !time) return setMessage("시작 시각을 넣으세요.");
    startTransition(async () => {
      const res = await addGroupClosure({ date, time: allDay ? null : time, minutes: allDay ? null : minutes, note });
      setMessage("error" in res ? res.error : (res.message ?? "막았습니다."));
      if (!("error" in res)) {
        setNote("");
        setOpen(false);
        router.refresh();
      }
    });
  };

  const field = "rounded-lg border border-border bg-background px-3 py-2 text-input tabular-nums";

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-dashed border-border px-4 py-2 text-body-sm text-muted hover:text-foreground"
        >
          + 이날 단체 막기
        </button>
        {message && <span className="text-micro text-muted">{message}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="text-body-sm font-semibold">
        이날 단체 막기 <span className="font-normal text-muted">— 겹치는 빈 회차도 같이 닫힙니다</span>
      </p>
      <div className="flex flex-wrap items-end gap-x-2 gap-y-3">
        <label className="flex items-center gap-2 self-center text-body-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          종일
        </label>
        {!allDay && (
          <>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="시작 시각"
              className={field}
              style={{ colorScheme: "dark" }}
            />
            <span className="flex items-center gap-1 text-body-sm">
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                aria-label="시간"
                className={`${field} w-16`}
              />
              시간
              <input
                type="number"
                min={0}
                max={59}
                step={10}
                value={mins}
                onChange={(e) => setMins(e.target.value)}
                aria-label="분"
                className={`${field} ml-1 w-16`}
              />
              분
            </span>
            {time && minutes && (
              <span className="self-center text-body-sm text-muted tabular-nums">
                {time} ~ {addMinutes(time, minutes)}
              </span>
            )}
          </>
        )}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모 (고객에게 안 보임) 예: 휴무"
        className={`${field} w-full`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-body-sm font-semibold text-brand-foreground disabled:opacity-40"
        >
          {pending ? "막는 중…" : "막기"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-body-sm text-muted">
          취소
        </button>
        {message && <span className="text-micro text-muted">{message}</span>}
      </div>
    </div>
  );
}
