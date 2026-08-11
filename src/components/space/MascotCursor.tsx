"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { MASCOTS } from "@/lib/mascots";
import { useMascotSelection } from "@/components/space/MascotSelectionContext";

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
    let visible = false;

    function handleMove(e: PointerEvent) {
      if (!el) return;
      if (!visible) {
        visible = true;
        el.style.opacity = "1";
      }
      const current = mascotRef.current;
      el.style.transform = `translate3d(${e.clientX - current.cursorWidth / 2}px, ${e.clientY - current.cursorHeight / 2}px, 0)`;
    }

    function handleLeave() {
      if (!el) return;
      visible = false;
      el.style.opacity = "0";
    }

    window.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", handleLeave);
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-200"
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
