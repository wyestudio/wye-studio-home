"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
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
import { DAY_RANK, blockedByGroup, sessionGo, sessionRank, sortDay, type GroupSlot } from "@/lib/adminDayOrder";
import { addGroupClosure, removeGroupClosure } from "./group-bookings/actions";
import { withBack } from "@/lib/adminBack";

export type DashboardSession = {
  id: string;
  theme_id: string | null;
  start_at: string;
  /** 끝나는 시각 — 단체 시간과 겹치는지 볼 때 쓴다. 모르면 null. */
  end_at: string | null;
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
  /** 입금까지 확인된 확정 인원 — 「진행 확정」 판정에 쓴다(adminDayOrder.ts sessionGo). */
  paid_confirmed: number;
  /** 정원. 모르면 null. */
  capacity_max: number | null;
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

/**
 * 구분색 — 값은 admin.css 에 있다(--cal-*). 라이트 / 다크 모드에서 각각 읽히는 값으로 바뀐다.
 * 예전에는 어두운 배경용 형광색을 여기 박아 두어 밝은 화면에서 안 읽혔다.
 * ⚠️ 색만으로 가르지 않는다. 칸 · 카드에 「단체 · 파티 · 노말 · 마감」 글자를 같이 쓴다.
 */
const COLOR = {
  party: "var(--cal-party)",
  normal: "var(--cal-normal)",
  other: "var(--cal-other)",
  group: "var(--cal-group)",
  block: "var(--cal-block)",
} as const;

/** 색을 옅게 — 예전의 16진수 투명도('26' · '66')를 대신한다(CSS 변수에는 투명도를 이어 붙일 수 없다). */
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

type Kind = "party" | "normal" | "other" | "group" | "inquiry" | "block";

/** 달력 칸 하나에 놓이는 것. 칸 안에서는 누를 수 없다 — 날짜만 고른다(2026-10-30 대표님, 잘못 눌러 넘어가는 게 거슬린다). */
type CalEvent = {
  key: string;
  date: string;
  time: string;
  kind: Kind;
  /** 칸에 적는 짧은 글(시각 뒤) — '단체 12명' · '파티 8명' · '마감'. */
  short: string;
  /** 마우스를 올리면 보이는 전체 설명. */
  label: string;
  /**
   * 칸 안의 순서 — 작을수록 위. 확정된 일정이 먼저다(2026-11-27 대표님, 규칙은 adminDayOrder.ts):
   * 단체 확정 0 → 진행 확정 회차(파티 · 노말 시간순) 1 → 신청은 있지만 미확정 2 → 마감 4 → 단체 문의 5 → 빈 회차 6 → 닫힌 회차 7.
   * 칸이 넘쳐 '+n' 으로 접혀도 단체 확정은 항상 보이는 쪽에 남는다.
   */
  rank: number;
  /** 꽉 찬 색으로 그린다(단체 확정 · 진행이 확정된 파티 · 노말 회차). */
  solid: boolean;
  /** 신청자가 없는 빈 회차 — 「빈 회차도 보기」 를 켜야 칸에 나온다. */
  empty: boolean;
};

const LEGEND: { kind: Kind; label: string; solid?: boolean }[] = [
  { kind: "group", label: "단체 확정", solid: true },
  { kind: "party", label: "파티" },
  { kind: "normal", label: "노말" },
  { kind: "block", label: "마감" },
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
  initialDate,
}: {
  sessions: DashboardSession[];
  groups: DashboardGroup[];
  closures: DashboardClosure[];
  siteUrl: string;
  /** 서버 렌더 시각 — 렌더 중 Date.now() 를 부르지 않는다. */
  nowMs: number;
  /** 주소의 ?date= — 상세에 갔다 돌아왔을 때 보던 날짜를 다시 연다. 없으면 오늘. */
  initialDate: string | null;
}) {
  const today = kstYmd(new Date(nowMs).toISOString());
  const [month, setMonth] = useState((initialDate ?? today).slice(0, 7));
  const [selected, setSelectedState] = useState(initialDate ?? today);
  // 고른 날짜를 주소에 남긴다 — 상세에서 돌아오면 그 날짜가 다시 열린다(2026-10-30 대표님).
  // ⚠️ router.replace 가 아니라 history.replaceState — 주소만 바꾸고 서버는 부르지 않는다(wye-server-cost).
  const setSelected = (d: string) => {
    setSelectedState(d);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?date=${d}`);
  };
  const back = `/?date=${selected}`;

  // 칸에 무엇까지 보일지 — 기본은 확정 · 모집된 것만(2026-11-27 대표님). 그날 목록에는 언제나 전부 나온다.
  const [showInquiry, setShowInquiry] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  // 확정된 단체 일정 — 이 시간과 겹쳐 닫힌 회차는 흐리게, 맨 아래로 보낸다.
  const groupSlots = useMemo<GroupSlot[]>(() => groups.flatMap((g) => (g.booking ? [g.booking] : [])), [groups]);

  const events = useMemo(() => {
    const list: CalEvent[] = [];
    for (const s of sessions) {
      if (s.status === "cancelled") continue;
      const kind = sessionKind(s);
      const mode = kind === "party" ? "파티" : kind === "normal" ? "노말" : (s.theme_name ?? "회차");
      // 신청자가 있는가 — 파티는 신청(확정 · 대기), 노말은 예약. 둘 다 취소를 뺀 인원이다.
      const empty = s.booked_people <= 0;
      // 진행 확정 — 파티는 isPartyGo, 노말은 입금이 확인되면(2026-11-27 대표님).
      const go = sessionGo(kind as "party" | "normal" | "other", s) === true;
      const people = kind === "normal" ? s.booked_people : s.confirmed;
      list.push({
        key: `s-${s.id}`,
        date: kstYmd(s.start_at),
        time: kstTime(s.start_at),
        kind,
        short: empty ? mode : `${mode} ${people}명`,
        label:
          kind === "normal"
            ? `${kstTime(s.start_at)} 노말 · ${empty ? "예약 없음" : `예약 ${s.booked_people}명 · ${s.payment_label ?? ""}${go ? " · 진행 확정" : ""}`}`
            : `${kstTime(s.start_at)} ${mode} · 확정 ${s.confirmed}명${s.capacity_max ? ` / 정원 ${s.capacity_max}명` : ""}${
                go ? " · 진행 확정" : empty ? " · 신청 없음" : " · 모집 중"
              }`,
        rank: sessionRank(kind as "party" | "normal" | "other", s, groupSlots),
        solid: go,
        empty,
      });
    }
    for (const g of groups) {
      if (g.booking) {
        list.push({
          key: `g-${g.id}`,
          date: g.booking.date,
          time: g.booking.time,
          kind: "group",
          short: `단체 ${g.headcount}명`,
          label: `${g.booking.time} 단체 확정 · ${g.name} · ${g.headcount}명`,
          rank: DAY_RANK.group,
          solid: true,
          empty: false,
        });
      } else if (OPEN_INQUIRY.has(g.status) && g.preferred_date) {
        const t = HHMM.test(g.preferred_time) ? g.preferred_time : "";
        list.push({
          key: `g-${g.id}`,
          date: g.preferred_date,
          time: t || "99:99",
          kind: "inquiry",
          short: `문의 ${g.headcount}명`,
          label: `${t ? `${t} ` : ""}단체 문의(희망) · ${g.name} · ${g.headcount}명`,
          rank: DAY_RANK.inquiry,
          solid: false,
          empty: false,
        });
      }
    }
    for (const c of closures) {
      list.push({
        key: `c-${c.id}`,
        date: c.date,
        time: c.start_time ?? "00:00",
        kind: "block",
        short: "마감",
        label: c.start_time ? `${c.start_time} 마감${c.note ? ` · ${c.note}` : ""}` : `종일 마감${c.note ? ` · ${c.note}` : ""}`,
        rank: DAY_RANK.closure,
        solid: false,
        empty: false,
      });
    }
    const byDate = new Map<string, CalEvent[]>();
    for (const e of list) {
      if (e.kind === "inquiry" && !showInquiry) continue;
      if (e.empty && !showEmpty) continue;
      byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
    }
    // 확정된 일정이 먼저, 그 안에서는 시간 순.
    for (const arr of byDate.values()) arr.sort((a, b) => a.rank - b.rank || a.time.localeCompare(b.time));
    return byDate;
  }, [sessions, groups, closures, groupSlots, showInquiry, showEmpty]);

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

  const daySessions = sessions.filter((s) => kstYmd(s.start_at) === selected);
  const dayGroups = groups.filter((g) => (g.booking ? g.booking.date === selected : OPEN_INQUIRY.has(g.status) && g.preferred_date === selected));
  const dayClosures = closures.filter((c) => c.date === selected);
  // 그날 목록 — 달력 칸과 같은 순서로 한 줄에 세운다(2026-11-27 대표님):
  // 단체 확정 → 진행이 확정된 파티 · 노말(시간순) → 신청은 있지만 미확정 → 마감 → 단체 문의 → 빈 회차 → 닫힌 회차.
  type DayItem =
    | { key: string; rank: number; time: string; type: "session"; s: DashboardSession; blocked: boolean }
    | { key: string; rank: number; time: string; type: "group"; g: DashboardGroup }
    | { key: string; rank: number; time: string; type: "closure"; c: DashboardClosure };
  const dayItems = sortDay<DayItem>([
    ...daySessions.map((s) => ({
      key: `s-${s.id}`,
      rank: sessionRank(sessionKind(s) as "party" | "normal" | "other", s, groupSlots),
      time: kstTime(s.start_at),
      type: "session" as const,
      s,
      blocked: blockedByGroup(s, groupSlots),
    })),
    ...dayGroups.map((g) => ({
      key: `g-${g.id}`,
      rank: g.booking ? DAY_RANK.group : DAY_RANK.inquiry,
      // 시간을 안 정한 문의는 그 묶음의 맨 뒤로.
      time: g.booking?.time ?? (HHMM.test(g.preferred_time) ? g.preferred_time : "99:99"),
      type: "group" as const,
      g,
    })),
    ...dayClosures.map((c) => ({ key: `c-${c.id}`, rank: DAY_RANK.closure, time: c.start_time ?? "00:00", type: "closure" as const, c })),
  ]);
  const firstOff = dayItems.findIndex((i) => i.rank === DAY_RANK.off);

  return (
    // 컴퓨터는 달력 왼쪽 · 그날 목록 오른쪽 — 달력이 화면 폭을 다 쓰면 너무 크다(2026-10-30 대표님).
    // 칸에 '단체 12명' 같은 글을 적게 되면서 달력 쪽을 넓혔다(2026-11-27). 휴대폰은 달력 아래에 그날 목록.
    <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-6">
      {/* ── 달 ── */}
      <div className="rounded-xl border border-border bg-surface p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="이전 달"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
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
                className="min-h-11 rounded-lg border border-border px-3 text-label text-muted hover:text-foreground"
              >
                오늘
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          >
            <Chevron dir="right" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-micro text-muted">
          {DOW.map((d, i) => (
            <div key={d} className={`pb-1 ${i === 0 ? "text-danger" : i === 6 ? "text-brand" : ""}`}>
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
                  isSel ? "bg-brand-soft" : "bg-surface hover:bg-fill-subtle"
                } ${inMonth ? "" : "[&>*]:opacity-40"}`}
              >
                <span
                  className={`text-micro tabular-nums ${
                    d === today
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand font-semibold text-brand-foreground"
                      : dow === 0
                        ? "text-danger"
                        : dow === 6
                          ? "text-brand"
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
                      style={{ backgroundColor: kindColor(e.kind), opacity: e.kind === "inquiry" || e.empty ? 0.45 : 1 }}
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

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted">
          {LEGEND.map((l) => (
            <span key={l.kind} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kindColor(l.kind) }} />
              {l.label}
            </span>
          ))}
        </div>
        {/* 기본은 확정 · 모집된 일정만. 켜면 칸에 연하게 더 나온다 — 그날 목록에는 언제나 전부 있다 */}
        <div className="mt-1 flex flex-wrap gap-x-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
            <input type="checkbox" checked={showInquiry} onChange={(e) => setShowInquiry(e.target.checked)} className="h-5 w-5" />
            단체 문의도 보기
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-foreground">
            <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="h-5 w-5" />
            빈 회차도 보기
          </label>
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
          {dayItems.map((item, i) => (
            <Fragment key={item.key}>
              {i === firstOff && (
                <p className="mt-2 text-body-sm text-muted">닫힌 회차 — 단체 시간과 겹쳐 닫혔거나 비활성화한 회차입니다.</p>
              )}
              {item.type === "session" ? (
                <SessionCard s={item.s} blocked={item.blocked} date={selected} siteUrl={siteUrl} nowMs={nowMs} back={back} />
              ) : item.type === "closure" ? (
                <ClosureRow c={item.c} />
              ) : (
                <GroupDayCard g={item.g} back={back} />
              )}
            </Fragment>
          ))}

          {/* 날짜를 바꾸면 새로 그린다 — 안 그러면 다른 날 막은 결과 문구가 남아 헷갈린다. */}
          <DayBlockForm key={selected} date={selected} />
        </div>
      </div>
    </div>
  );
}

/** 그날 목록의 단체 한 건 — 확정이면 확정 일시, 문의면 희망 일시. 누르면 단체 상세로. */
function GroupDayCard({ g, back }: { g: DashboardGroup; back: string }) {
  return (
    <Link
      href={withBack(`/group-bookings/${g.id}`, back)}
      className="flex items-center gap-3 rounded-lg border bg-surface p-4 hover:bg-fill-subtle"
      style={{ borderColor: tint(COLOR.group, g.booking ? 60 : 25) }}
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
          style={{ backgroundColor: tint(COLOR.group, 15), color: COLOR.group }}
        >
          {g.booking ? "단체 확정" : `단체 문의(희망) · ${inquiryStatusLabel(g.status)}`}
        </span>
        <span className="mt-1 block text-micro text-muted">
          {g.name} · {g.headcount}명
        </span>
      </span>
      <Chevron className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}

function EventChip({ e }: { e: CalEvent }) {
  const color = kindColor(e.kind);
  const faint = e.kind === "inquiry" || e.empty;
  const time = e.kind === "block" && e.time === "00:00" ? "종일" : e.time === "99:99" ? "" : e.time;
  return (
    <span
      title={e.label}
      className="block truncate rounded-md px-1 text-micro leading-5 tabular-nums"
      style={
        e.solid
          ? // 확정된 일정(단체 확정 · 파티 진행 확정)은 꽉 찬 색 — 한눈에 먼저 들어와야 한다
            { backgroundColor: color, color: "var(--cal-on)" }
          : {
              backgroundColor: tint(color, faint ? 8 : 15),
              color,
              opacity: e.empty ? 0.7 : 1,
              // 테두리는 outline 으로 — border 는 폭을 먹어 좁은 칸에서 글자가 잘린다.
              ...(e.kind === "inquiry" ? { outline: `1px dashed ${tint(color, 40)}`, outlineOffset: "-1px" } : {}),
            }
      }
    >
      {/* 시각 + 종류(단체 · 파티 · 노말 · 마감) + 인원. 색만으로 가르지 않는다 */}
      {time && <span className="font-semibold">{time} </span>}
      {e.short}
    </span>
  );
}

function SessionCard({
  s,
  blocked,
  date,
  siteUrl,
  nowMs,
  back,
}: {
  s: DashboardSession;
  /** 단체 시간과 겹쳐 닫힌 회차 — 흐리게 그리고 이유를 적는다. */
  blocked: boolean;
  date: string;
  siteUrl: string;
  nowMs: number;
  /** 상세의 「← 대시보드」 가 돌아올 주소(고른 날짜 포함). */
  back: string;
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
          ? { label: "모집중", cls: "bg-brand text-brand-foreground" }
          : { label: "마감", cls: "bg-zinc-500 text-white" };
  // 신청자가 있으면 진행 여부를 같이 적는다 — 파티는 isPartyGo, 노말은 입금이 확인되면 확정(adminDayOrder.ts).
  const go = sessionGo(kind as "party" | "normal" | "other", s);
  // 닫힌 회차(단체 시간과 겹침 · 비활성화)는 흐리게 — 아래 버튼은 그대로 눌린다.
  const off = blocked || s.status === "cancelled";
  return (
    <div className="rounded-lg border border-border bg-surface" style={{ borderLeft: `3px solid ${color}` }}>
      {/* 카드 윗부분을 누르면 회차 상세(신청자)로 — 단체 카드와 같은 모양 */}
      <Link
        href={withBack(`/sessions/${s.id}`, back)}
        className={`flex items-center gap-3 rounded-t-lg p-4 pb-3 hover:bg-fill-subtle ${off ? "opacity-60" : ""}`}
      >
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
            {go !== null && (
              <span
                className={`rounded-md px-2 py-0.5 text-micro font-semibold ${
                  go ? "bg-confirm-soft text-confirm" : "bg-wait-soft text-wait"
                }`}
              >
                {go ? "진행 확정" : kind === "normal" ? "입금 확인 전" : "인원 모으는 중"}
              </span>
            )}
            {/* 색 · 흐림만으로 알리지 않는다 — 왜 닫혔는지 글자로 적는다 */}
            {blocked && <span className="rounded-md bg-fill-strong px-2 py-0.5 text-micro font-semibold text-muted">단체 시간과 겹침</span>}
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
            <span className="mt-0.5 block text-micro text-wait">공개 예정: {formatDateTimeFull(s.opens_at)}</span>
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
    <div className="flex items-center gap-3 rounded-lg border bg-surface p-4" style={{ borderColor: tint(COLOR.block, 40) }}>
      <span className="min-w-0 flex-1">
        <span className="font-semibold tabular-nums">
          {c.start_time ? `${c.start_time} ~ ${addMinutes(c.start_time, c.minutes ?? BASE_MINUTES)}` : "종일"}
        </span>
        <span
          className="ml-2 rounded-md px-1.5 py-0.5 text-micro"
          style={{ backgroundColor: tint(COLOR.block, 15), color: COLOR.block }}
        >
          단체 막음
        </span>
        {c.note && <span className="mt-1 block text-micro text-muted">{c.note}</span>}
        {error && <span className="mt-1 block text-micro text-danger">{error}</span>}
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
          className="min-h-11 rounded-lg border border-dashed border-line px-4 text-body-sm text-muted hover:text-foreground"
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
