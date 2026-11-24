"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Chevron } from "@/components/ui/Chevron";
import { GROUP_EVENT, pushGa4Event } from "@/lib/analytics";
import { GROUP_PAGE_LABEL } from "@/lib/groupBooking";
import {
  BROCHURE_COVER,
  BROCHURE_PAGES,
  BROCHURE_PDF,
  BROCHURE_PDF_SIZE,
  BROCHURE_RATIO,
  brochurePage,
} from "@/lib/groupBrochure";

/*
  단체 첫 화면의 소개서 카드 + 전체 화면 뷰어(2026-11-24 대표님). 배경은 groupBrochure.ts.

  ⚠️ 서버를 부르지 않는다(wye-server-cost). 열고 닫기는 이 컴포넌트의 상태뿐이고,
     뒤로가기로 닫히게 하려고 쓰는 것도 history.pushState 다 — router 를 쓰면 force-dynamic
     페이지가 서버에서 다시 그려진다. 그림 · PDF 는 정적 파일이라 CDN 에서 바로 나간다.
  ⚠️ 넘기기는 브라우저 기본 가로 스크롤(scroll-snap)이다. 손가락 밀기 · 관성 · 트랙패드가
     기기마다 자연스럽게 동작하고, 핀치 확대도 막지 않는다.
  ⚠️ 그림은 <img> 로 원본 주소를 쓴다(next/image 최적화를 거치면 검색 제외 헤더가 빠진다).
*/

const TOTAL = BROCHURE_PAGES.length;

function track(name: string, params: { sectionKey?: string; sectionIndex?: number } = {}) {
  pushGa4Event(name, { themeLabel: GROUP_PAGE_LABEL, ...params });
}

export function BrochureCard() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // 닫은 뒤 키보드 위치를 카드로 돌려준다.
    triggerRef.current?.focus();
  }, []);

  return (
    // data-quote-ignore: 이 안의 포커스를 '견적 시작' 으로 세지 않는다(GroupQuoteFlow 의 onFocusCapture).
    <div data-quote-ignore className="flex flex-col gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(true);
          track(GROUP_EVENT.brochureOpen, { sectionKey: "hero" });
        }}
        className="flex items-center gap-3.5 rounded-xl border border-panel-border bg-panel p-2.5 pr-4 text-left transition-colors hover:border-line-strong"
      >
        {/* 표지 그림이 곧 '무엇을 여는지' 의 설명이다 — 모르는 파일이 아니라는 걸 보여 준다. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 검색 제외 헤더가 붙은 원본 주소를 써야 한다 */}
        <img
          src={BROCHURE_COVER}
          alt=""
          width={640}
          height={359}
          decoding="async"
          className="w-28 shrink-0 rounded-md border border-line-subtle"
          style={{ aspectRatio: BROCHURE_RATIO }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">단체 프로그램 소개서</span>
          <span className="text-body-sm text-muted">{TOTAL}쪽 · 바로 보기</span>
        </span>
        <Chevron dir="right" className="h-4 w-4 shrink-0 text-muted" />
      </button>
      <a
        href={BROCHURE_PDF}
        target="_blank"
        rel="noopener"
        onClick={() => track(GROUP_EVENT.brochureDownload, { sectionKey: "hero" })}
        // 혼자 서 있는 링크다 — 누르는 높이를 44px 로 두고 -my 로 주변 여백을 먹는다(첫 화면의 '테마 보기' 링크와 같다).
        className="-my-2 inline-flex h-11 items-center self-start text-body-sm text-muted underline underline-offset-4 hover:text-foreground"
      >
        회사 공유용 PDF 받기 ({BROCHURE_PDF_SIZE})
      </a>
      {open && <BrochureViewer onClose={close} />}
    </div>
  );
}

function BrochureViewer({ onClose }: { onClose: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(0);
  // 닫을 때 '어디까지 봤는지' 를 한 번만 보낸다 — 넘길 때마다 보내면 이벤트가 쌓인다.
  const farthest = useRef(0);
  const closing = useRef(false);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(TOTAL - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, []);

  // 닫기는 한 길로 모은다: 버튼 · Esc · 바깥 누르기 → history.back() → popstate → 실제로 닫기.
  // 휴대폰 뒤로가기도 같은 popstate 로 들어온다. 뷰어를 연 채 뒤로가기를 누르면
  // 페이지를 떠나 버리는 게 가장 흔한 불편이라 막아 둔다.
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    window.history.back();
  }, []);

  useEffect(() => {
    // Next 가 쓰는 state 를 그대로 복사해 둔다 — state 를 비우면 Next 가 앞으로 가기 때
    // 이 항목을 모르는 기록으로 보고 페이지를 새로 불러온다.
    // 개발 모드(StrictMode)는 effect 를 두 번 돌린다 — 이미 쌓았으면 또 쌓지 않는다.
    if (!window.history.state?.wyeBrochure) {
      window.history.pushState({ ...(window.history.state ?? {}), wyeBrochure: true }, "");
    }
    const onPop = () => {
      track(GROUP_EVENT.brochureRead, { sectionIndex: farthest.current + 1 });
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key === "ArrowRight") goTo(currentIndex() + 1);
      if (e.key === "ArrowLeft") goTo(currentIndex() - 1);
    };
    const currentIndex = () => {
      const el = trackRef.current;
      return el ? Math.round(el.scrollLeft / el.clientWidth) : 0;
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    // 뒤 페이지가 같이 스크롤되지 않게 잠근다.
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
    };
  }, [onClose, requestClose, goTo]);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== page) setPage(i);
    if (i > farthest.current) farthest.current = i;
  }

  return createPortal(
    <div
      data-quote-ignore
      role="dialog"
      aria-modal="true"
      aria-label="단체 프로그램 소개서"
      className="animate-fade-in fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
        <p className="min-w-0 flex-1 truncate text-body font-semibold">단체 프로그램 소개서</p>
        <p className="text-label tabular-nums text-muted" aria-live="polite">
          {page + 1} / {TOTAL}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={requestClose}
          aria-label="소개서 닫기"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-fill hover:text-foreground"
        >
          {/* 글자(✕)가 아니라 SVG — 글꼴에 없는 기호는 기기마다 다른 글자로 보인다(wye-customer-facing). */}
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {BROCHURE_PAGES.map((alt, i) => (
            // [container-type:size] — 그림 폭을 이 칸의 폭 · 높이로 계산한다(아래 img 의 cqw · cqh).
            <div key={i} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-4 [container-type:size] lg:px-20">
              {/* eslint-disable-next-line @next/next/no-img-element -- 검색 제외 헤더가 붙은 원본 주소를 써야 한다 */}
              <img
                src={brochurePage(i)}
                alt={`${i + 1}쪽: ${alt}`}
                width={1600}
                height={897}
                // 처음 몇 장만 바로, 나머지는 다가갈 때 받는다 — 17장(1.4MB)을 한꺼번에 받지 않는다.
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                // 칸 안에 비율대로 꽉 차게(contain): 폭 = min(칸 폭, 칸 높이 × 비율).
                // ⚠️ w-full 이면 가로 화면에서 칸이 그림보다 넓어 양옆에 배경 띠가 생기고, w-auto 면 그림이
                //    오기 전 크기가 0 이라 넘길 때 빈 칸이 튄다. 그림이 오기 전부터 크기가 정해져야 한다.
                className="h-auto rounded-lg bg-fill-subtle"
                style={{ aspectRatio: BROCHURE_RATIO, width: `min(100cqw, calc(100cqh * ${BROCHURE_RATIO}))` }}
              />
            </div>
          ))}
        </div>

        {/* PC 에서만 화살표 버튼. 휴대폰은 손가락으로 민다. */}
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page === 0}
          aria-label="이전 쪽"
          className="absolute left-4 hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-foreground hover:border-line-strong disabled:opacity-30 lg:flex"
        >
          <Chevron dir="left" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page === TOTAL - 1}
          aria-label="다음 쪽"
          className="absolute right-4 hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-foreground hover:border-line-strong disabled:opacity-30 lg:flex"
        >
          <Chevron dir="right" className="h-4 w-4" />
        </button>
      </div>

      {/* 휴대폰을 가로로 돌리면 세로 높이가 400px 안팎이라 아래 줄을 접어 슬라이드에 자리를 준다. PDF 는 첫 화면 링크로도 받는다. */}
      <div className="flex flex-col items-center gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:hidden">
        {/* 휴대폰 세로 화면에서는 슬라이드 글자가 작다 — 가로로 돌리면 화면을 꽉 채운다. */}
        <p className="text-body-sm text-muted portrait:block landscape:hidden lg:hidden">
          옆으로 밀어 넘기고, 가로로 돌리면 크게 보여요
        </p>
        <a
          href={BROCHURE_PDF}
          target="_blank"
          rel="noopener"
          onClick={() => track(GROUP_EVENT.brochureDownload, { sectionKey: "viewer" })}
          className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-label font-semibold hover:border-line-strong"
        >
          회사 공유용 PDF 받기 ({BROCHURE_PDF_SIZE})
        </a>
      </div>
    </div>,
    document.body
  );
}
