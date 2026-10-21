"use client";

import { useEffect, useRef, useState } from "react";
import { Creepster } from "next/font/google";

/*
  BOO! 글자 전용. 녹아내리는 공포체라 시안의 'BOO!' 느낌이 난다.
  ⚠️ preload 하지 않는다 — 누르기 전엔 안 쓰는 글꼴을 모든 페이지가 받게 된다.
     유령이 뜨면 그때 받아 둔다(아래 useEffect).
*/
const creepster = Creepster({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

/** 말풍선 문구. 2초마다 하나씩 돌아가며 뜬다. */
const TAUNTS = ["Trick or treat!", "날 눌러 봐", "심심해…", "Boo?"];

/** 각 단계의 길이(ms). 사라짐 → BOO! → 걷힘 → 돌아옴. */
const VANISH_MS = 650;
const BOO_MS = 1700;
const LEAVE_MS = 350;
const RETURN_MS = 600;

type Phase = "idle" | "vanish" | "boo" | "leave" | "return";

/**
 * 오른쪽 가장자리 유령 — 이스터에그.
 *
 * 2초마다 말풍선으로 눌러 보라고 꼬시고, 누르면 스르륵 사라졌다가 화면 가득 BOO! 하고
 * 튀어나온 뒤 제자리로 돌아온다(2026-10-21 대표님).
 *
 * 배경 장식(SeasonBackdrop)은 콘텐츠 **뒤**에 깔려 클릭을 못 받으므로 이 유령만 따로
 * 콘텐츠 **앞**에 띄운다. 자리·크기·애니메이션은 season.css 의 .season-egg 에 있다.
 */
export function GhostEasterEgg() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [taunt, setTaunt] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // 글꼴은 미리 받아 둔다 — BOO! 가 뜬 순간 받으면 처음 몇 프레임이 기본 글꼴로 나온다.
    document.fonts?.load(`1em ${creepster.style.fontFamily}`).catch(() => {});

    let n = 0;
    let hide = 0;
    const id = window.setInterval(() => {
      setTaunt(n++ % TAUNTS.length);
      hide = window.setTimeout(() => setTaunt(null), 1300);
    }, 2000);
    const pending = timers;
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hide);
      pending.current.forEach(window.clearTimeout);
    };
  }, []);

  function at(ms: number, next: Phase) {
    timers.current.push(window.setTimeout(() => setPhase(next), ms));
  }

  function play() {
    if (phase !== "idle") return;
    setPhase("vanish");
    at(VANISH_MS, "boo");
    at(VANISH_MS + BOO_MS, "leave");
    at(VANISH_MS + BOO_MS + LEAVE_MS, "return");
    at(VANISH_MS + BOO_MS + LEAVE_MS + RETURN_MS, "idle");
  }

  // BOO! 화면을 누르거나 Esc 를 누르면 바로 걷는다.
  function dismiss() {
    if (phase !== "boo") return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setPhase("leave");
    at(LEAVE_MS, "return");
    at(LEAVE_MS + RETURN_MS, "idle");
  }

  useEffect(() => {
    if (phase !== "boo") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // dismiss 는 phase 만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const showBoo = phase === "boo" || phase === "leave";

  return (
    <>
      <button
        type="button"
        onClick={play}
        aria-label="유령 누르기"
        data-phase={phase}
        className="season-only season-egg"
      >
        {/* 장식 그림이라 SeasonArt 와 같은 파일을 쓴다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/season/halloween/ghost.svg" alt="" draggable={false} className="season-egg-ghost" />
        <span aria-hidden className="season-egg-bubble" data-show={taunt !== null && phase === "idle" ? "" : undefined}>
          {TAUNTS[taunt ?? 0]}
        </span>
      </button>

      {showBoo && (
        <div
          aria-hidden
          onClick={dismiss}
          data-leaving={phase === "leave" ? "" : undefined}
          className="season-boo"
        >
          <p className={`season-boo-text ${creepster.className}`}>BOO!</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/season/halloween/ghost.svg" alt="" draggable={false} className="season-boo-ghost" />
        </div>
      )}
    </>
  );
}
