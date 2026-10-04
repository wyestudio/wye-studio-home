"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SessionView } from "@/types/catalog";
import type { SessionStats } from "@/types/domain";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { EarlyBirdBanner } from "@/components/promo/EarlyBirdBanner";
import { scrollToBooking } from "./scrollToBooking";
import { DETAIL_EVENT, pushGa4Event } from "@/lib/analytics";

export type PickerSession = SessionView & {
  stats: SessionStats | null;
  remaining: number | null;
  bookable: boolean;
  /**
   * 얼리버드 대상 회차인가.
   *
   * ⚠️ **서버가 판정해서 내려준다.** 여기서 브라우저 시각으로 다시 계산하면,
   *    시계가 틀어진 기기에서 화면엔 얼리버드로 보이는데 제출하면 기본가가
   *    청구되는 일이 생긴다(판정 기준은 src/lib/promotion.ts 주석 참고).
   */
  earlyBird: boolean;
  /**
   * 이미 시작한(끝난) 회차인가.
   *
   * 지난 회차를 목록에서 빼지 않고 '마감' 으로 남긴다 — 매주 회차가 돌아간 이력이
   * 달력에 그대로 보여야 한다는 요청(2026-10-04).
   *
   * 화면 라벨은 자리가 없는 회차와 똑같이 '마감' 이다. 이 값이 따로 필요한 건
   * **마감 클릭 지표에서 빼기 위해서**다(아래 onClick 주석).
   *
   * ⚠️ **서버가 판정한다.** 여기서 브라우저 시각으로 다시 계산하면 시계가 틀어진
   *    기기에서 끝난 회차가 고를 수 있는 것처럼 보인다(earlyBird 와 같은 이유).
   *    고를 수 없게 막는 쪽은 bookable 이 이미 false 로 내려온다.
   */
  past: boolean;
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
export type PickerPromotion = {
  badgeLabel: string;
  accentColor: string;
  bannerTitle: string;
  bannerBody: string | null;
  bannerHighlight: string | null;
  bannerNote: string | null;
};

export function SessionPicker({
  themeSlug,
  themeName,
  sessions,
  accentColor,
  accepting,
  openingDate,
  promo = null,
}: {
  themeSlug: string;
  /** GA4 에 실어 보낼 테마명. 다른 이벤트들과 같은 값(theme.name)이어야 한다. */
  themeName: string;
  sessions: PickerSession[];
  accentColor: string;
  /** 달력에 '오픈' 으로 표시할 날짜. */
  openingDate: string | null;
  /** 테마가 '신청 받기' 상태인가. false 면 회차가 있어도 신청할 수 없다. */
  accepting: boolean;
  /**
   * 켜져 있는 프로모션. 없으면 배너·색·배지가 통째로 빠지고 예전 화면 그대로다.
   * 어느 회차가 대상인지는 각 회차의 earlyBird 가 들고 있다(서버 판정).
   */
  promo?: PickerPromotion | null;
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
    const map = new Map<string, { hasOpen: boolean; hasEarlyBird: boolean }>();
    for (const [d, list] of byDate)
      map.set(d, {
        hasOpen: list.some((s) => s.bookable),
        // 하루 안에서 회차마다 갈리지는 않는다(판정 기준이 날짜라서). 그래도
        // some 으로 보는 건, 마감된 회차만 남은 날도 색은 유지돼야 해서다.
        hasEarlyBird: list.some((s) => s.earlyBird),
      });
    return map;
  }, [byDate]);

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);

  /*
    처음 열렸을 때 고를 날짜.

    ⚠️ 링크로 받은 날짜(?d=)가 **이미 마감이면 그 날을 열지 않는다.** 공유된
       링크를 뒤늦게 누른 사람에게 시간 세 개가 전부 '마감' 인 첫 화면이
       보였다(2026-10-04 UX 진단 P0). 신청 가능한 날로 옮기고 왜 옮겼는지
       알려 준다(missedDate).

    ⚠️ 마지막 보루가 dates[0] 이면 **제일 오래된 지난 회차**로 떨어진다
       (지난 회차가 목록에 들어온 뒤부터). 신청 가능한 날 → 아직 안 지난 날 →
       그래도 없으면 제일 최근 날 순으로 내려간다. 달력은 이 날짜가 있는 달부터
       펼쳐지므로, 여기서 과거로 떨어지면 첫 화면이 지난 달이 된다.
  */
  const { initialDate, missedDate } = (() => {
    const bookable = dates.find((d) => byDate.get(d)!.some((s) => s.bookable));
    const fallback = (() => {
      if (bookable) return bookable;
      const upcoming = dates.find((d) => byDate.get(d)!.some((s) => !s.past));
      return upcoming ?? dates[dates.length - 1] ?? "";
    })();

    const q = params.get("d");
    if (!q || !byDate.has(q)) return { initialDate: fallback, missedDate: null };
    // 링크가 가리킨 날에 아직 신청할 수 있는 회차가 있으면 그대로 연다.
    if (byDate.get(q)!.some((s) => s.bookable)) return { initialDate: q, missedDate: null };
    // 마감된 날이다. 옮겨 갈 곳이 없으면(전 회차 마감) 안내 없이 그 날을 보여준다.
    if (!bookable) return { initialDate: q, missedDate: null };
    return { initialDate: bookable, missedDate: q };
  })();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /*
    안내는 한 번만 보여준다. 사용자가 달력에서 다른 날을 고르면 지운다 —
    이미 스스로 날짜를 옮긴 사람에게 "선택하신 날은 마감됐어요" 가 계속
    붙어 있으면 지금 고른 날이 마감인 줄 안다.
  */
  const [missedNotice, setMissedNotice] = useState(missedDate);

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
    // 스스로 날짜를 골랐으면 '마감돼서 옮겼다' 안내는 더 보여주지 않는다.
    setMissedNotice(null);
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

  /*
    고른 회차가 얼리버드면 **고른 표시(배경·버튼)까지 프로모션 색**으로 간다.
    달력 칸이 이미 그 색이라, 거기서 이어지는 회차 칸과 신청 버튼만 테마색이면
    같은 선택을 두 색으로 말하는 꼴이 된다(2026-10-01 요청).
    ⚠️ 색 자체는 어드민에서 고르는 값이다(promotions.accent_color) — 주석에도
       코드에도 특정 색을 박지 않는다.
  */
  const selectedIsEarlyBird = Boolean(promo && selected?.earlyBird);
  const ctaColor = selectedIsEarlyBird ? promo!.accentColor : accentColor;
  /** 고른 회차 칸의 배경색. 얼리버드 회차만 프로모션 색이고 나머지는 테마 강조색이다. */
  const activeColor = (s: PickerSession) =>
    promo && s.earlyBird ? promo.accentColor : accentColor;

  const banner = promo ? (
    <EarlyBirdBanner
      title={promo.bannerTitle}
      body={promo.bannerBody}
      highlight={promo.bannerHighlight}
      note={promo.bannerNote}
      accent={promo.accentColor}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
    {/*
      공유된 링크(?d=)가 가리킨 날이 이미 마감이라 가장 가까운 신청 가능 날짜로
      옮겨 왔다는 안내. 왜 내가 안 고른 날이 열려 있는지 알려 준다.
    */}
    {missedNotice && (
      <p
        role="status"
        className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-body-sm text-white/85"
      >
        <span className="font-semibold text-foreground">
          {kstDayLabel(`${missedNotice}T00:00:00+09:00`)}
        </span>
        {" 회차는 마감됐어요. 가장 가까운 "}
        <span className="font-semibold text-foreground">
          {kstDayLabel(`${initialDate}T00:00:00+09:00`)}
        </span>
        {/* 조사는 앞말에 붙인다 — "(토) 로" 처럼 띄우면 어색하다. */}
        {"로 옮겨 뒀어요."}
      </p>
    )}
    <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-8">
      <div className="md:w-[19rem] md:shrink-0 lg:w-[23rem]">
        <p className="mb-2 text-xs font-bold text-muted lg:text-sm">날짜 선택</p>
        <BookingCalendar
          dateStatus={dateStatus}
          selected={selectedDate}
          accentColor={accentColor}
          openingDate={openingDate}
          onSelect={selectDate}
          promoColor={promo?.accentColor ?? null}
          promoLabel={promo?.badgeLabel ?? "얼리버드"}
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
          /*
            회차는 **한 줄에 하나씩** 쌓는다(2026-10-01). 예전에는 2~3열 격자였는데,
            칸이 좁아 시각 말고는 아무것도 못 붙였다. 한 줄을 다 쓰면 왼쪽에 시각,
            오른쪽에 상태(얼리버드·마감)를 두는 자리가 생긴다.
            '예약 가능' 은 적지 않는다 — 모두 가능한 날엔 읽을 게 없는 줄이 된다.
          */
          <div className="flex flex-col gap-2">
            {daySessions.map((s) => {
              const isActive = s.id === selectedId;
              const showEarlyBird = Boolean(promo && s.earlyBird && s.bookable);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (!s.bookable) {
                      // ⚠️ 지난 회차는 세지 않는다. soldOutClick 은 "원하는 날짜가
                      //    마감이었다" 를 재는 지표인데, 끝난 회차를 구경한 클릭이
                      //    섞이면 회차를 더 열어야 한다는 신호로 잘못 읽힌다.
                      if (s.past) return;
                      // 고를 수는 없지만 **눌렀다는 건 센다.** 마감 회차만 눌러보고
                      // 나간 사람은 화면이 어려운 게 아니라 원하는 날짜가 없는 것이다
                      // — 고칠 곳이 카피가 아니라 회차 편성이라는 뜻이라 갈라 놔야 한다.
                      pushGa4Event(DETAIL_EVENT.soldOutClick, {
                        themeLabel: themeName,
                        appSessionId: s.id,
                      });
                      return;
                    }
                    setSelectedId(s.id);
                    pushGa4Event(DETAIL_EVENT.sessionPick, {
                      themeLabel: themeName,
                      appSessionId: s.id,
                    });
                  }}
                  // ⚠️ disabled 가 아니라 aria-disabled 다. disabled 버튼은 브라우저가
                  //    클릭 자체를 삼켜서 '마감을 눌러봤다' 를 잴 방법이 없다.
                  //    고를 수 없는 건 위 onClick 이 early return 으로 막는다.
                  aria-disabled={!s.bookable}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-40 lg:px-5 lg:py-4 ${
                    isActive ? "border-transparent" : "border-white/20 hover:border-white/40"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: activeColor(s), color: "#0a0a12" }
                      : undefined
                  }
                >
                  <p className="text-base font-bold tabular-nums lg:text-lg">{kstTime(s.start_at)}</p>

                  {/*
                    회차 태그(sessions.badge). 회차가 여럿 열려 있으면 "아무도 신청
                    안 했나?" 싶어 망설인다는 의견이 있어, 사람이 몰리는 시각을
                    눈에 띄게 한다(2026-09-16).
                    ⚠️ 고른 칸은 배경이 강조색이라 같은 색 알약은 묻힌다 — 그때는 어두운 알약으로 뒤집는다.
                  */}
                  {s.badge && s.bookable && (
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-micro font-extrabold leading-tight ${
                        isActive ? "bg-[#0a0a12] text-white" : ""
                      }`}
                      style={isActive ? undefined : { backgroundColor: accentColor, color: "#0a0a12" }}
                    >
                      {s.badge}
                    </span>
                  )}

                  <span className="ml-auto flex items-center gap-2">
                    {/*
                      얼리버드 배지.
                      ⚠️ 고른 칸은 배경이 이미 프로모션 색이라 같은 색 알약이 묻힌다 —
                         그때만 어두운 알약으로 뒤집는다(인기 태그와 같은 규칙).
                    */}
                    {showEarlyBird && (
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-extrabold leading-tight ${
                          isActive ? "bg-[#0a0a12] text-white" : ""
                        }`}
                        style={
                          isActive
                            ? undefined
                            : { backgroundColor: promo!.accentColor, color: "#0a0a12" }
                        }
                      >
                        {promo!.badgeLabel}
                      </span>
                    )}
                    {/*
                      지난 회차도 '마감' 이다. 한때 '종료' 로 갈라 적었는데, 지난
                      회차는 **날짜 자체가 이미 지난 날**이라(달력도 지난 달을 펴야
                      나온다) 라벨까지 뜻을 나눌 필요가 없었다. 라벨이 둘이면 읽는
                      쪽이 '못 고른다' 를 두 번 해석한다.
                    */}
                    {!s.bookable && <span className="text-xs text-muted">마감</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/*
          얼리버드 안내 — **좁은 화면 전용 자리.**
          회차 목록 바로 아래다. 배지를 먼저 본 뒤 "저게 뭐지" 로 내려오는 순서라
          위에 두면 아직 못 본 배지를 설명하게 된다.
          넓은 화면에서는 달력+시간 묶음 **아래로** 빠진다(아래 md 전용 자리).
        */}
        {banner && <div className="mt-3 md:hidden">{banner}</div>}

        <div className="mt-auto pt-5">
          <BookingCta
            accepting={accepting}
            href={selected ? `/themes/${themeSlug}/apply?session=${selected.id}` : null}
            label={ctaLabel}
            accentColor={ctaColor}
            themeName={themeName}
            selectedId={selected?.id ?? null}
          />
        </div>
      </div>
    </div>

    {/*
      얼리버드 안내 — **넓은 화면 전용 자리.**
      달력 | 시간선택(신청 버튼 포함) 두 칸을 가로질러 한 줄로 깔린다.
      시간 칸 안에 두면 오른쪽 절반 폭에 갇혀 배너가 접히고, 신청 버튼을
      아래로 밀어 달력 아래끝과 어긋난다(2026-10-01 요청).
      ⚠️ 같은 배너를 두 번 그리는 대신 자리만 둘로 나눴다 — 보이는 건 언제나 하나다.
    */}
    {banner && <div className="hidden md:block">{banner}</div>}
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
  themeName,
  selectedId,
}: {
  accepting: boolean;
  href: string | null;
  label: string;
  accentColor: string;
  themeName: string;
  selectedId: string | null;
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

  // 두 버튼(제자리 · 모바일 하단 고정)이 같은 동작이라 한 곳에서 기록한다.
  const trackApplyClick = () =>
    pushGa4Event(DETAIL_EVENT.applyClick, {
      themeLabel: themeName,
      appSessionId: selectedId,
    });

  const inner = !accepting ? (
    <div className="rounded-lg border border-white/15 bg-white/5 px-6 py-4 text-center">
      <p className="font-semibold">현재 신청을 받고 있지 않습니다.</p>
      <p className="mt-1 text-sm text-muted">신청이 열리면 공지로 안내드릴게요.</p>
    </div>
  ) : href ? (
    <a
      href={href}
      onClick={trackApplyClick}
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
              onClick={trackApplyClick}
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
              onClick={(e) => {
                // 신청 의사는 있는데 회차를 아직 안 골랐다. 위 apply 클릭과 갈라
                // 둬야 '버튼을 못 찾은 것' 과 '고를 회차가 없는 것' 이 구분된다.
                pushGa4Event(DETAIL_EVENT.bookingScroll, { themeLabel: themeName });
                scrollToBooking(e);
              }}
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
