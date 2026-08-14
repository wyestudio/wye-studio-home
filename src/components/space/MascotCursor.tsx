"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { MASCOTS } from "@/lib/mascots";
import { useMascotSelection } from "@/components/space/MascotSelectionContext";

// 클릭 가능한 요소 위에서는 마스코트 커서가 버튼/링크 위 텍스트나 호버 애니메이션을
// 가려버려서(예: 헤더 메뉴의 글자 스왑 효과) 옅게 만들어 아래 내용이 잘 보이게 한다.
const INTERACTIVE_SELECTOR = "a, button, [role='button'], input, select, textarea, label";
const DIMMED_OPACITY = "0.3";

export function MascotCursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { selectedMascot } = useMascotSelection();
  const mascot = MASCOTS[selectedMascot];
  const mascotRef = useRef(mascot);

  useEffect(() => {
    mascotRef.current = mascot;
  }, [mascot]);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer.matches || reduceMotion) return;

    const el = wrapperRef.current;
    if (!el) return;

    document.body.style.cursor = "none";
    // 링크(<a href>)는 브라우저 기본 스타일시트가 cursor: pointer를 그 요소에
    // 직접 지정해버려서, body의 cursor:none은 상속으로만 내려가기 때문에 못 이긴다
    // (상속값보다 요소 자신에게 붙은 규칙이 항상 우선 — 그게 브라우저 기본값이라도).
    // globals.css의 html.custom-cursor-active 규칙이 a/button 등을 직접 겨냥해서
    // 이겨야 하므로, 이 클래스를 켜서 그 규칙을 활성화한다.
    document.documentElement.classList.add("custom-cursor-active");

    function handleMove(e: PointerEvent) {
      if (!el) return;
      const current = mascotRef.current;
      el.style.transform = `translate3d(${e.clientX - current.cursorWidth / 2}px, ${e.clientY - current.cursorHeight / 2}px, 0)`;
      const target = e.target as HTMLElement | null;
      const isInteractive = !!target?.closest(INTERACTIVE_SELECTOR);
      el.style.opacity = isInteractive ? DIMMED_OPACITY : "1";
    }

    function handleLeave() {
      if (!el) return;
      el.style.opacity = "0";
    }

    window.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", handleLeave);
      document.body.style.cursor = "";
      document.documentElement.classList.remove("custom-cursor-active");
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] opacity-0 transition-opacity duration-200"
      style={{ willChange: "transform" }}
    >
      <Image
        src={mascot.cursorSrc}
        alt=""
        width={mascot.cursorWidth}
        height={mascot.cursorHeight}
        className="drop-shadow-[0_0_10px_var(--glow)]"
      />
    </div>
  );
}
