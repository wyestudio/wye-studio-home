"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * 동그라미 물음표 + 말풍선 설명.
 *
 * 마우스가 있는 기기는 올리면 뜨고, 터치 기기는 누르면 뜬다(다시 누르거나 바깥을
 * 누르면 닫힘).
 *
 * 말풍선 자리
 *   오른쪽에 둔다. 아래로 열었더니 바로 밑 테마명·난이도 칸을 덮었다(2026-09-15 의견).
 *   세로로는 **물음표 아래끝에 맞춰 위쪽으로** 자라게 한다 — 물음표 위는 빈 여백이고
 *   아래는 테마 정보라서. 위로 자라다 헤더에 닿으면 그만큼 내린다.
 *   오른쪽 자리가 좁은 화면(모바일)은 어쩔 수 없이 아래로 열고 화면 안쪽으로 밀어 넣는다.
 *
 * ⚠️ 위치는 열린 직후 재서 스타일을 직접 넣는다(그리기 전이라 깜빡임 없음). 상태로
 *    두면 한 번 더 그려야 하고 린트(react-hooks)도 막는다.
 * ⚠️ 물음표는 글자(?)가 아니라 SVG 다. 본문 글꼴에 없는 기호로 그리면 기기마다
 *    다른 모양으로 보인다(Chevron.tsx 사고 참고).
 */
const EDGE = 12;
const GAP = 10;
/** 오른쪽에 이만큼도 자리가 없으면 아래로 연다. */
const MIN_SIDE_WIDTH = 220;
/** 오른쪽으로 열 때 최대 폭. 넓을수록 줄 수가 줄어 위로 덜 자란다. */
const MAX_SIDE_WIDTH = 384;

export function InfoTooltip({
  text,
  label,
  className = "",
}: {
  text: string;
  /** 스크린리더용 버튼 이름. 예: '파티형 방탈출 설명 보기' */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const bubble = bubbleRef.current;
    const tail = tailRef.current;
    if (!open || !wrap || !bubble || !tail) return;

    const vw = document.documentElement.clientWidth;
    const icon = wrap.getBoundingClientRect();
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    const sideSpace = vw - EDGE - (icon.right + GAP);

    if (sideSpace >= MIN_SIDE_WIDTH) {
      // ── 오른쪽 ──
      bubble.style.maxWidth = `${Math.min(MAX_SIDE_WIDTH, sideSpace)}px`;
      bubble.style.left = `${icon.width + GAP}px`;
      bubble.style.transform = "none";
      const h = bubble.getBoundingClientRect().height;
      // 물음표 아래끝에 말풍선 아래끝을 맞춰 위로 자라게. 헤더에 닿으면 내린다.
      let top = icon.height + 6 - h;
      const minTop = headerBottom + 8 - icon.top;
      if (top < minTop) top = minTop;
      bubble.style.top = `${top}px`;
      // 꼬리는 왼쪽 가장자리에서 물음표 가운데를 가리킨다.
      tail.style.left = "-5px";
      tail.style.top = `${icon.height / 2 - top - 5}px`;
      tail.style.transform = "rotate(-45deg)";
    } else {
      // ── 아래 (좁은 화면) ──
      bubble.style.maxWidth = `min(17rem, calc(100vw - ${EDGE * 2}px))`;
      bubble.style.left = `${icon.width / 2}px`;
      bubble.style.top = `${icon.height + GAP}px`;
      bubble.style.transform = "translateX(-50%)";
      const rect = bubble.getBoundingClientRect();
      let shift = 0;
      if (rect.right > vw - EDGE) shift = vw - EDGE - rect.right;
      else if (rect.left < EDGE) shift = EDGE - rect.left;
      bubble.style.transform = `translateX(calc(-50% + ${shift}px))`;
      tail.style.left = `calc(50% - ${shift}px - 5px)`;
      tail.style.top = "-5px";
      tail.style.transform = "rotate(45deg)";
    }
    bubble.style.visibility = "visible";
  }, [open]);

  // 바깥을 누르거나 Esc 를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canHover = () => window.matchMedia("(hover: hover)").matches;

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => canHover() && setOpen(true)}
      onMouseLeave={() => canHover() && setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        // 마우스 기기는 올리는 순간 이미 열려 있다. 그때 누르면 닫혀버리니 열기만 한다.
        onClick={() => (canHover() ? setOpen(true) : setOpen((v) => !v))}
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7.75 7.9a2.3 2.3 0 0 1 4.47.75c0 1.5-2.22 1.9-2.22 3.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14.4" r="0.95" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          // 자리를 재기 전 한 순간 엉뚱한 곳에 보이지 않게 숨겨 둔다(재고 나서 visible).
          style={{ visibility: "hidden" }}
          className="absolute left-0 top-0 z-30 block w-max rounded-lg border border-white/15 bg-[#161826] px-3.5 py-2.5 text-left text-xs font-medium leading-relaxed tracking-normal text-foreground shadow-xl sm:text-sm"
        >
          {/* 꼬리. 테두리 두 변만 그린 네모를 돌려 삼각형처럼 보이게 한다. */}
          <span
            ref={tailRef}
            aria-hidden
            className="absolute block h-2.5 w-2.5 border-l border-t border-white/15 bg-[#161826]"
          />
          {text}
        </span>
      )}
    </span>
  );
}
