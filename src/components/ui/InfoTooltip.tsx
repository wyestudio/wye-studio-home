"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * 동그라미 물음표 + 말풍선 설명.
 *
 * 마우스가 있는 기기는 올리면 뜨고, 터치 기기는 누르면 뜬다(다시 누르거나 바깥을
 * 누르면 닫힘). 둘 다 되게 한 이유: 노트북 터치패드 사용자도 클릭부터 해본다.
 *
 * ⚠️ 말풍선은 absolute 라 주변 배치를 밀지 않는다. 화면 가장자리에 걸리면 안쪽으로
 *    밀어 넣고, 꼬리(삼각형)는 물음표를 계속 가리키게 따로 옮긴다.
 * ⚠️ 물음표는 글자(?)가 아니라 SVG 다. 본문 글꼴에 없는 기호로 그리면 기기마다
 *    다른 모양으로 보인다(Chevron.tsx 사고 참고).
 */
export function InfoTooltip({
  text,
  label,
  className = "",
}: {
  text: string;
  /** 스크린리더용 버튼 이름. 예: '파티형 방탈출이란?' */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  // 화면 밖으로 삐져나가면 안쪽으로 민다. 열릴 때마다 가운데 정렬로 그린 뒤 재서 옮긴다.
  // 상태(setState)로 두면 한 번 더 그려야 해서, 그리기 전에 스타일을 직접 고친다.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const tail = tailRef.current;
    if (!open || !bubble || !tail) return;
    const margin = 12;
    const rect = bubble.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let shift = 0;
    if (rect.right > vw - margin) shift = vw - margin - rect.right;
    else if (rect.left < margin) shift = margin - rect.left;
    bubble.style.transform = `translateX(calc(-50% + ${shift}px))`;
    tail.style.transform = `translateX(calc(-50% - ${shift}px)) rotate(45deg)`;
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
          className="absolute left-1/2 top-full z-30 mt-2.5 block w-max max-w-[min(17rem,calc(100vw-24px))] rounded-lg border border-white/15 bg-[#161826] px-3.5 py-2.5 text-left text-xs font-medium leading-relaxed text-foreground shadow-xl sm:text-sm"
          style={{ transform: "translateX(-50%)" }}
        >
          {/* 꼬리. 말풍선을 민 만큼 반대로 옮겨 물음표를 계속 가리킨다. */}
          <span
            ref={tailRef}
            aria-hidden
            className="absolute -top-[5px] left-1/2 block h-2.5 w-2.5 border-l border-t border-white/15 bg-[#161826]"
            style={{ transform: "translateX(-50%) rotate(45deg)" }}
          />
          {text}
        </span>
      )}
    </span>
  );
}
