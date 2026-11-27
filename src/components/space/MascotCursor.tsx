"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { mascotsForSkin, mascotGlow } from "@/lib/mascots";
import { useSiteSkin } from "@/components/season/SeasonContext";
import { useMascotSelection } from "@/components/space/MascotSelectionContext";

// 클릭 가능한 요소 위에서는 마스코트 커서가 버튼/링크 위 텍스트나 호버 애니메이션을
// 가려버려서(예: 헤더 메뉴의 글자 스왑 효과) 옅게 만들어 아래 내용이 잘 보이게 한다.
const INTERACTIVE_SELECTOR = "a, button, [role='button'], input, select, textarea, label";
const DIMMED_OPACITY = "0.3";
/*
  잡거나 끌 수 있는 것(data-grab — 크리스마스 장면의 눈덩이 · 우쥬 · 케이프 · 이스 썰매) 위에서도 똑같이 흐려진다.
  잡는 동안은 커서 마스코트가 살짝 커졌다가 놓으면 돌아온다 — 손 모양 커서(grab) 대신 이것이 "잡았다" 를 알린다
  (2026-11-27 대표님).
*/
const GRAB_SELECTOR = "[data-grab]";
const GRAB_SCALE = "scale(1.25)";

export function MascotCursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { selectedMascot } = useMascotSelection();
  // 시즌 스킨이면 커서도 할로윈 그림(유령 우쥬 · 뱀파이어 이스 · 미라 케이프).
  const mascot = mascotsForSkin(useSiteSkin())[selectedMascot];
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
      const isInteractive = !!target?.closest(`${INTERACTIVE_SELECTOR}, ${GRAB_SELECTOR}`);
      el.style.opacity = isInteractive ? DIMMED_OPACITY : "1";
    }

    /*
      iframe 위로 들어가면 마스코트를 감춘다.

      ⚠️ 크로스 오리진 iframe(인스타 임베드) 안에서는 부모 창에 pointermove 가
         오지 않는다. 그대로 두면 마스코트가 마지막 위치에 굳어버려서
         "커서와 캐릭터가 분리된" 것처럼 보인다(2026-09-14 제보).
         iframe 안에서는 그 문서의 기본 커서가 보이므로, 우리 마스코트만
         조용히 빼는 것이 맞다. 밖으로 나오면 pointermove 가 다시 켜준다.
    */
    function handleOver(e: PointerEvent) {
      if (!el) return;
      if ((e.target as HTMLElement | null)?.tagName === "IFRAME") el.style.opacity = "0";
    }

    function handleLeave() {
      if (!el) return;
      el.style.opacity = "0";
    }

    // 크기는 안쪽 그림에 준다 — 바깥 칸의 transform 은 커서 자리(translate)가 쓰고 있다
    function handleDown(e: PointerEvent) {
      const img = el?.firstElementChild as HTMLElement | null;
      if (img && (e.target as HTMLElement | null)?.closest(GRAB_SELECTOR)) img.style.transform = GRAB_SCALE;
    }

    function handleUp() {
      const img = el?.firstElementChild as HTMLElement | null;
      if (img) img.style.transform = "";
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerdown", handleDown);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    document.addEventListener("pointerover", handleOver);
    document.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.removeEventListener("pointerover", handleOver);
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
        style={{ filter: mascotGlow(mascot.id, 10), transition: "transform 0.18s cubic-bezier(0.2, 1.4, 0.4, 1)" }}
      />
    </div>
  );
}
