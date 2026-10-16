"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chevron } from "@/components/ui/Chevron";

type Quote = { text: string; meta?: string };

/** 이 개수부터 격자 대신 자동으로 넘어가는 슬라이드로 보인다. */
const CAROUSEL_FROM = 5;
/** 다음 페이지로 넘어가는 간격. 한 줄 후기 두 개를 읽기에 넉넉한 시간. */
const INTERVAL_MS = 5000;
/** 카드 사이 간격(px). 아래 gap-3 / sm:gap-4 와 같아야 페이지 폭 계산이 맞는다. */
const GAP = { base: 12, sm: 16 };

/**
 * 한 줄 후기.
 *
 * 4개까지는 격자로 다 보여주고, 5개부터는 한 페이지(모바일 1장, 넓은 화면 2장)씩
 * 옆으로 넘기는 슬라이드가 된다. 일정 간격으로 다음 페이지로 넘어가고, 마지막
 * 페이지에서는 첫 페이지로 돌아간다.
 *
 * ⚠️ 자동 넘김은 읽는 사람을 방해하지 않게 멈춘다 — 마우스를 올렸을 때, 손가락을
 *    대고 있을 때, 키보드로 안에 들어와 있을 때, 화면 밖에 있을 때, 탭이 가려졌을 때,
 *    그리고 OS 에서 '동작 줄이기' 를 켠 사람에게는 아예 돌지 않는다.
 */
export function QuoteList({ quotes, accent }: { quotes: Quote[]; accent: string }) {
  if (quotes.length < CAROUSEL_FROM) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {quotes.map((q, i) => (
          <QuoteCard key={i} q={q} accent={accent} />
        ))}
      </div>
    );
  }
  return <QuoteCarousel quotes={quotes} accent={accent} />;
}

function QuoteCarousel({ quotes, accent }: { quotes: Quote[]; accent: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  // 손으로 넘긴 직후에는 타이머를 처음부터 다시 센다. 넘기자마자 또 넘어가면 놓친다.
  const [kick, setKick] = useState(0);

  /** 한 페이지 폭 = 보이는 폭 + 카드 사이 간격(페이지 사이에도 간격이 하나 있다). */
  const pageWidth = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 1;
    const gap = window.matchMedia("(min-width: 640px)").matches ? GAP.sm : GAP.base;
    return el.clientWidth + gap;
  }, []);

  // 페이지 수·현재 페이지. 화면 폭이 바뀌면(모바일 1장 ↔ 2장) 다시 센다.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      const w = pageWidth();
      const total = Math.max(1, Math.ceil((el.scrollWidth + (w - el.clientWidth)) / w - 0.01));
      setPages(total);
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setPage(atEnd ? total - 1 : Math.round(el.scrollLeft / w));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [quotes.length, pageWidth]);

  // 화면에 보일 때만 돈다. 아래로 지나간 뒤에도 돌면 돌아왔을 때 엉뚱한 페이지다.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.4,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const goTo = useCallback(
    (p: number) => {
      const el = trackRef.current;
      if (!el) return;
      el.scrollTo({ left: p * pageWidth(), behavior: reduced ? "auto" : "smooth" });
    },
    [pageWidth, reduced]
  );

  useEffect(() => {
    if (paused || !visible || reduced || pages < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      // 마지막 페이지면 첫 페이지로 돌아간다.
      goTo(atEnd ? 0 : Math.round(el.scrollLeft / pageWidth()) + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, visible, reduced, pages, goTo, pageWidth, kick]);

  const manual = (p: number) => {
    goTo((p + pages) % pages);
    setKick((k) => k + 1);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="한 줄 후기"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => {
        setPaused(false);
        setKick((k) => k + 1);
      }}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto sm:gap-4
                   [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {quotes.map((q, i) => (
          <div
            key={i}
            className="flex w-full shrink-0 snap-start sm:w-[calc((100%-16px)/2)]"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${quotes.length}`}
          >
            <QuoteCard q={q} accent={accent} />
          </div>
        ))}
      </div>

      {/* 화살표 + 페이지 점. 점은 지금 어디쯤인지와 남은 양을 알려준다. */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <ArrowButton dir={-1} onClick={() => manual(page - 1)} />
        <div className="flex items-center gap-1.5">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => manual(i)}
              aria-label={`${i + 1}번째 페이지`}
              aria-current={i === page}
              className={`h-2 rounded-full transition-all ${i === page ? "" : "bg-muted/40"}`}
              style={{ width: i === page ? 20 : 8, ...(i === page ? { backgroundColor: accent } : {}) }}
            />
          ))}
        </div>
        <ArrowButton dir={1} onClick={() => manual(page + 1)} />
      </div>
    </div>
  );
}

function ArrowButton({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === -1 ? "이전 후기" : "다음 후기"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-panel-border
                 bg-panel text-foreground"
    >
      <Chevron dir={dir === -1 ? "left" : "right"} className="h-4 w-4" />
    </button>
  );
}

/** 카드 한 장. 인용부호는 CSS 로 깔아 글자 수를 늘리지 않는다. */
function QuoteCard({ q, accent }: { q: Quote; accent: string }) {
  return (
    <figure className="relative w-full rounded-xl border border-panel-border bg-panel p-5 sm:p-6">
      <span
        aria-hidden
        className="absolute left-4 top-2 select-none text-h2 leading-none opacity-25 sm:left-5"
        style={{ color: accent }}
      >
        &ldquo;
      </span>
      <blockquote className="relative pt-3 text-body leading-relaxed text-foreground">
        {q.text}
      </blockquote>
      {q.meta && <figcaption className="mt-3 text-body-sm text-muted">{q.meta}</figcaption>}
    </figure>
  );
}
