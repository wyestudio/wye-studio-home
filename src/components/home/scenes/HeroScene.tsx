"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { MascotOrbit } from "@/components/space/MascotOrbit";
import { MascotFreeRoam } from "@/components/space/MascotFreeRoam";
import { HeroCtaButton } from "@/components/home/HeroCtaButton";
import { HeroWarp } from "@/components/home/space/HeroWarp";
import { DecodeText } from "@/components/home/DecodeText";
import { SeasonArt } from "@/components/season/SeasonArt";
import { useSiteSkin } from "@/components/season/SeasonContext";
import { HALLOWEEN_ROAM } from "@/lib/mascots";
import { clamp01 } from "@/lib/motion";
import { useIsMobileViewport } from "@/lib/useIsMobileViewport";

export function HeroScene({
  index = 0,
  total = 1,
  range,
}: {
  index?: number;
  total?: number;
  range?: { start: number; end: number; unitSpan?: number };
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);
  const mascotProgress = clamp01((local - 0.7) / 0.3);
  const isMobile = useIsMobileViewport();
  // 할로윈 동안은 데스크톱도 모바일처럼 자유이동이다(움직임은 HALLOWEEN_ROAM).
  const halloween = useSiteSkin() === "halloween";

  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [contentRadius, setContentRadius] = useState(0);

  /*
    마우스 시차 — 마우스 위치(-1~1)를 천천히 따라가며 겹마다 다른 폭으로 민다.
    별(HeroWarp, 가장 멀다) 40px · 마스코트(MascotOrbit) 14px · 로고 · 문구 6px(가장 가깝게 고정된 판).
    값은 ref 로만 오간다 — 상태로 두면 초당 60번 다시 그린다.
  */
  const pointer = useRef({ x: 0, y: 0 });
  const contentLayerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduceMotion) return;
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return; // 손가락은 누를 때만 위치가 생겨 화면이 튄다
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = pointer.current;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
      p.x += dx * 0.06;
      p.y += dy * 0.06;
      const el = contentLayerRef.current;
      if (el) el.style.transform = `translate3d(${p.x * 6}px, ${p.y * 6}px, 0)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  useEffect(() => {
    const wrapper = contentWrapperRef.current;
    if (!wrapper) return;

    function measure() {
      const w = wrapper!.offsetWidth;
      const h = wrapper!.offsetHeight;
      if (w > 0 && h > 0) {
        const radius = Math.sqrt((w / 2) ** 2 + (h / 2) ** 2);
        setContentRadius(radius);
      }
    }

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <SceneShell local={local} reduceMotion={reduceMotion} index={index} isFirst={isFirst} isLast={isLast}>
      {/* 입체 별 — 다가오다가 스크롤해 벗어날 때 빨라진다. 모션 줄이기에서는 사이트 배경 별만 둔다. */}
      {!reduceMotion && <HeroWarp local={local} pointer={pointer} />}
      {reduceMotion || (!isMobile && !halloween) ? (
        <MascotOrbit progress={mascotProgress} reduceMotion={reduceMotion} minRadius={contentRadius} pointer={pointer} />
      ) : (
        <MascotFreeRoam
          // 모바일 ↔ 데스크톱으로 바뀌면 크기가 달라 처음부터 다시 배치한다.
          key={isMobile ? "mobile" : "desktop"}
          progress={mascotProgress}
          reduceMotion={reduceMotion}
          contentRef={contentWrapperRef}
          scale={isMobile ? 0.7 : 1}
          roam={halloween ? HALLOWEEN_ROAM : undefined}
        />
      )}
      <div
        ref={contentLayerRef}
        className="pointer-events-none relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center"
      >
        {/*
          시즌 스킨 — 오른쪽 위 박쥐(season.css). 꺼지면 감춰진다.
          ⚠️ contentWrapperRef **바깥**에 둔다. 안에 두면 궤도 반지름 계산이 장식 크기를 먹는다.
          ⚠️ 로고 뒤 반투명 달빛 원은 걷었다(2026-10-21 대표님).
        */}
        <SeasonArt art="bat-dark" className="season-hero-bat hidden md:block" />
        <div ref={contentWrapperRef} className="inline-flex flex-col items-center gap-3 text-center">
          <span className="season-logo">
            <Image
              src="/logo-white.png"
              alt="Would You Escape"
              width={138}
              height={96}
              priority
              className="h-[4.6rem] w-auto sm:h-[6.6rem]"
            />
            <SeasonArt art="witch-hat" className="season-hat season-hat--hero" />
          </span>
          {/*
            행성 이름표(PLANET 01)와 같은 Geist Mono, 소문자 그대로. 고정폭이라 글자 사이가 원래 넓어
            자간을 좁힌다. Orbitron · 대문자 · 두 줄 안과 나란히 비교해 대표님이 골랐다.
            크기는 척도 맨 위(text-display, 3rem)보다 한 단계 크게 — Tailwind 눈금의 다음 칸(6xl, 3.75rem).
            사이트의 첫 문장 하나뿐이라 척도 밖에 둔다. 360px 폭에서도 한 줄(2rem).
          */}
          {/* 커서가 지나가는 글자가 기호로 깜빡이다 돌아온다(해독). 처음 뜰 때는 왼쪽부터 풀린다 */}
          <DecodeText
            text="would you escape?"
            className="whitespace-nowrap font-mono text-[2rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[3rem] lg:text-[3.75rem]"
          />
          <HeroCtaButton />
        </div>


      </div>

      {/*
        스크롤 안내.
        ⚠️ absolute 로 띄운다. 흐름에 두면 로고·문구·YES 묶음의 세로 가운데가
           이것 때문에 위로 밀린다. 정중앙은 그대로 두고 안내만 아래에 둔다.
        히어로가 빠져나갈 때 같이 사라져야 하므로 SceneShell 안에 둔다
        (SceneShell 이 씬 전체 투명도를 관리한다 — 따로 계산하지 않는다).
      */}
      <ScrollCue />
    </SceneShell>
  );
}

/**
 * "아래로 더 있다"는 표시.
 *
 * 첫 화면만 보고 나가는 사람이 있어 넣었다. 장식 요소라 클릭은 받지 않는다
 * (히어로 래퍼가 pointer-events-none 이고 여기서 되살리지 않는다 — 되살리면
 *  겹쳐 쌓인 다른 씬의 클릭까지 가로챈다).
 */
function ScrollCue() {
  return (
    <div
      aria-hidden
      className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-10"
    >
      {/* 얇아서 안 보인다는 제보(2026-09-14) — 굵기·크기를 올리고 별 배경에서도
          읽히도록 어두운 그림자를 깔았다. */}
      <span
        className="font-mono text-xs font-semibold tracking-[0.38em] text-white"
        style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}
      >
        SCROLL
      </span>
      <span className="scroll-cue-rail" />
    </div>
  );
}
