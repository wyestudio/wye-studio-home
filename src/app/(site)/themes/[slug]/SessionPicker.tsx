"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SessionView } from "@/types/catalog";
import type { SessionStats } from "@/types/domain";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { scrollToBooking } from "./scrollToBooking";

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
 *
 * 배치는 넓은 화면에서 달력 | 시간 2열, 좁은 화면에서는 위아래로 쌓인다.
 * 신청 버튼은 mt-auto 로 밀어 달력 아래 끝선에 맞춘다.
 *
 * 예전에는 포스터 옆 칸에 있었는데(2026-09-15 까지), 그 자리를 난이도·시간·
 * 장르·시놉시스에 내주고 상세 설명 블록처럼 아래 섹션으로 내려왔다.
 */
export function SessionPicker({
  themeSlug,
  sessions,
  accentColor,
  accepting,
  openingDate,
}: {
  themeSlug: string;
  sessions: PickerSession[];
  accentColor: string;
  /** 달력에 '오픈' 으로 표시할 날짜. */
  openingDate: string | null;
  /** 테마가 '신청 받기' 상태인가. false 면 회차가 있어도 신청할 수 없다. */
  accepting: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const timeRef = useRef<HTMLDivElement>(null);

  // 날짜별로 묶는다 (하루에 여러 회차가 있으므로).
  const byDate = useMemo(() => {
    const map = new Map<string, PickerSession[]>();
    for (const s of sessions) {
      const d = kstDate(s.start_at);
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    return map;
  }, [sessions]);

  const dateStatus = useMemo(() => {
    const map = new Map<string, { hasOpen: boolean }>();
    for (const [d, list] of byDate) map.set(d, { hasOpen: list.some((s) => s.bookable) });
    return map;
  }, [byDate]);

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);

  const initialDate = (() => {
    const q = params.get("d");
    if (q && byDate.has(q)) return q;
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

  const ctaLabel = selected
    ? `${kstDayLabel(selected.start_at)} ${kstTime(selected.start_at)} 신청하기`
    : "날짜와 시간을 선택해주세요";

  function selectDate(d: string) {
    setSelectedDate(d);
    setSelectedId(null);
    const next = new URLSearchParams(params.toString());
    next.set("d", d);
    router.replace(`/themes/${themeSlug}?${next.toString()}`, { scroll: false });
    // 좁은 화면에서는 시간 목록이 달력 아래라 화면 밖에 있다. 눈에 보이게 옮겨준다.
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() =>
        timeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      );
    }
  }

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-8">
      <div className="md:w-[19rem] md:shrink-0 lg:w-[23rem]">
        <p className="mb-2 text-xs font-bold text-muted lg:text-sm">날짜 선택</p>
        <BookingCalendar
          dateStatus={dateStatus}
          selected={selectedDate}
          accentColor={accentColor}
          openingDate={openingDate}
          onSelect={selectDate}
        />
      </div>

      {/* 시간 칸은 달력과 같은 높이로 늘어난다. 신청 버튼을 mt-auto 로 밀면
          버튼 아래끝이 달력 아래끝(=포스터 아래끝)과 같은 선에 놓인다. */}
      <div ref={timeRef} className="flex min-w-0 flex-1 scroll-mt-28 flex-col">
        <p className="mb-2 text-xs font-bold text-muted lg:text-sm">
          시간 선택
          {selectedDate && (
            <span className="ml-1.5 font-medium text-white/70">
              {kstDayLabel(`${selectedDate}T00:00:00+09:00`)}
            </span>
          )}
        </p>

        {daySessions.length === 0 ? (
          <p className="rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-muted">
            이 날짜에는 회차가 없습니다. 달력에서 점이 있는 날짜를 골라주세요.
          </p>
        ) : (
          /* 시각만 크게. 고를 수 없는 회차에만 '마감' 을 덧붙인다 —
             모두 예약 가능한 날에 '예약 가능' 이 반복되면 읽을 게 없다. */
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {daySessions.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  disabled={!s.bookable}
                  className={`relative rounded-lg border py-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 lg:py-4 ${
                    isActive ? "border-transparent" : "border-white/20 hover:border-white/40"
                  }`}
                  style={isActive ? { backgroundColor: accentColor, color: "#0a0a12" } : undefined}
                >
                  {/*
                    회차 태그(sessions.badge). 쇼핑몰 상품 목록의 'BEST' 처럼 **칸 모서리에 걸친**
                    작은 알약이다(2026-09-16). 회차가 여럿 열려 있으면 "아무도 신청 안 했나?" 싶어
                    망설인다는 의견이 있어, 사람이 몰리는 시각을 눈에 띄게 한다.
                    ⚠️ 고른 칸은 배경이 강조색이라 같은 색 알약은 묻힌다 — 그때는 어두운 알약으로 뒤집는다.
                  */}
                  {s.badge && s.bookable && (
                    <span
                      className={`absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-tight shadow-sm sm:text-[11px] ${
                        isActive ? "bg-[#0a0a12] text-white" : ""
                      }`}
                      style={isActive ? undefined : { backgroundColor: accentColor, color: "#0a0a12" }}
                    >
                      {s.badge}
                    </span>
                  )}
                  <p className="text-base font-bold lg:text-lg">{kstTime(s.start_at)}</p>
                  {!s.bookable && <p className="mt-0.5 text-xs text-muted">마감</p>}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-auto pt-5">
          <BookingCta
            accepting={accepting}
            href={selected ? `/themes/${themeSlug}/apply?session=${selected.id}` : null}
            label={ctaLabel}
            accentColor={accentColor}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 신청 버튼.
 *
 * 데스크톱에서는 자리에 그대로 둔다. 모바일은 상세를 읽으려고 스크롤하면
 * 버튼이 화면 밖으로 나가버리므로, 버튼이 안 보이게 되는 순간부터
 * 하단에 고정한다.
 */
function BookingCta({
  accepting,
  href,
  label,
  accentColor,
}: {
  accepting: boolean;
  href: string | null;
  label: string;
  accentColor: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    // 원래 자리가 화면에서 벗어나면 하단 고정으로 전환한다.
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      // 하단에 고정된 버튼 높이만큼 여유를 둬 깜빡임을 막는다.
      rootMargin: "0px 0px -88px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const inner = !accepting ? (
    <div className="rounded-lg border border-white/15 bg-white/5 px-6 py-4 text-center">
      <p className="font-semibold">현재 신청을 받고 있지 않습니다.</p>
      <p className="mt-1 text-sm text-muted">신청이 열리면 공지로 안내드릴게요.</p>
    </div>
  ) : href ? (
    <a
      href={href}
      className="block rounded-lg px-6 py-4 text-center text-base font-bold transition-opacity hover:opacity-90"
      style={{ backgroundColor: accentColor, color: "#0a0a12" }}
    >
      {label}
    </a>
  ) : (
    <button
      disabled
      className="w-full cursor-not-allowed rounded-lg border border-white/15 px-6 py-4 text-center text-base font-bold text-muted"
    >
      {label}
    </button>
  );

  return (
    <>
      <div ref={anchorRef}>{inner}</div>

      {/*
        모바일 전용 하단 고정. 원래 버튼이 화면 밖일 때만 뜬다.
        mobile-cta-bar 는 카카오 채널 버튼이 이 막대를 비켜 가도록 알리는
        표식이다 — globals.css 의 body:has(.mobile-cta-bar) 규칙이 읽는다.
      */}
      {stuck && accepting && (
        <div className="mobile-cta-bar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 p-3 backdrop-blur sm:hidden">
          {href ? (
            <a
              href={href}
              className="block rounded-lg px-6 py-3.5 text-center text-base font-bold"
              style={{ backgroundColor: accentColor, color: "#0a0a12" }}
            >
              {label}
            </a>
          ) : (
            /*
              아직 회차를 안 골랐다. 달력이 테마 소개 아래로 내려가면서 첫 화면에서는
              달력이 안 보이므로, 눌리지 않는 회색 버튼 대신 달력으로 데려간다.
            */
            <a
              href="#booking"
              onClick={scrollToBooking}
              className="block rounded-lg border px-6 py-3.5 text-center text-base font-bold"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              신청하기
            </a>
          )}
        </div>
      )}
    </>
  );
}
