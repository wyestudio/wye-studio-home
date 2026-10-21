"use client";

import { useEffect, useRef, useState } from "react";
import { Creepster } from "next/font/google";

/*
  BOO! 글자 전용. 녹아내리는 공포체라 시안의 'BOO!' 느낌이 난다.
  ⚠️ preload 하지 않는다 — 누르기 전엔 안 쓰는 글꼴을 모든 페이지가 받게 된다.
     유령이 뜨면 그때 받아 둔다(아래 useEffect).
*/
const creepster = Creepster({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

/** 말풍선 문구. 하나씩 돌아가며 뜬다. */
const TAUNTS = ["Trick or treat!", "날 눌러 봐", "Boo?"];

/*
  말풍선은 가끔만 — 2초마다 띄웠더니 말이 많고 본문에 자꾸 겹쳤다(2026-10-21 대표님).
  들어와서 잠깐 뒤 처음 뜨고, 그 뒤로 6초마다 2.5초씩.
*/
const TAUNT_FIRST_MS = 4000;
const TAUNT_EVERY_MS = 6000;
const TAUNT_SHOW_MS = 2500;

/** 각 단계의 길이(ms). 사라짐 → (빈 화면) → BOO! → 걷힘 → 돌아옴. */
const VANISH_MS = 650;
/** 사라진 뒤 BOO! 까지 비워 두는 시간 — "어디 갔지? 다시 나오나?" 할 즈음 튀어나온다. */
const GONE_MS = 1800;
const BOO_MS = 1700;
const LEAVE_MS = 350;
const RETURN_MS = 600;

type Phase = "idle" | "vanish" | "boo" | "leave" | "return";

/**
 * 오른쪽 가장자리 유령 — 이스터에그.
 *
 * 가끔 말풍선으로 눌러 보라고 꼬시고, 누르면 스르륵 사라졌다가 잠깐 뒤 화면 가득 BOO! 하고
 * 튀어나온 뒤 제자리로 돌아온다(2026-10-21 대표님).
 *
 * 배경 장식(SeasonBackdrop)은 콘텐츠 **뒤**에 깔려 클릭을 못 받으므로 이 유령만 따로
 * 콘텐츠 **앞**에 띄운다. 자리·크기·애니메이션은 season.css 의 .season-egg 에 있다.
 */
export function GhostEasterEgg() {
  const [phase, setPhase] = useState<Phase>("idle");
  /*
    문구 번호와 보임 여부를 따로 든다. 하나로 합쳐 숨길 때 null 로 지웠더니, 사라지는
    0.2초 동안 글자가 첫 문구('Trick or treat!')로 바뀌어 보였다(2026-10-21 대표님).
  */
  const [taunt, setTaunt] = useState(0);
  const [talking, setTalking] = useState(false);
  /*
    스크롤하는 동안. 모바일은 본문 옆 여백이 20px 뿐이라 유령·말풍선이 본문에 겹친다 —
    읽으며 내리는 동안엔 화면 밖으로 숨고(season.css), 멈추면 다시 빼꼼 나온다(2026-10-21 대표님).
  */
  const [scrolling, setScrolling] = useState(false);
  const scrollingRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // 글꼴은 미리 받아 둔다 — BOO! 가 뜬 순간 받으면 처음 몇 프레임이 기본 글꼴로 나온다.
    document.fonts?.load(`1em ${creepster.style.fontFamily}`).catch(() => {});

    let n = 0;
    let hide = 0;
    let id = 0;
    const say = () => {
      if (scrollingRef.current) return;
      setTaunt(n++ % TAUNTS.length);
      setTalking(true);
      hide = window.setTimeout(() => setTalking(false), TAUNT_SHOW_MS);
    };
    const first = window.setTimeout(() => {
      say();
      id = window.setInterval(say, TAUNT_EVERY_MS);
    }, TAUNT_FIRST_MS);
    let still = 0;
    const onScroll = () => {
      if (!scrollingRef.current) {
        scrollingRef.current = true;
        setScrolling(true);
        setTalking(false);
      }
      window.clearTimeout(still);
      still = window.setTimeout(() => {
        scrollingRef.current = false;
        setScrolling(false);
      }, 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const pending = timers;
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(still);
      window.clearTimeout(first);
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
    // vanish 단계 동안 유령은 사라진 채로(애니메이션 forwards) 빈 화면을 둔다.
    setPhase("vanish");
    const boo = VANISH_MS + GONE_MS;
    at(boo, "boo");
    at(boo + BOO_MS, "leave");
    at(boo + BOO_MS + LEAVE_MS, "return");
    at(boo + BOO_MS + LEAVE_MS + RETURN_MS, "idle");
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
        data-scrolling={scrolling ? "" : undefined}
        className="season-only season-egg"
      >
        {/* 장식 그림이라 SeasonArt 와 같은 파일을 쓴다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/season/halloween/ghost.svg" alt="" draggable={false} className="season-egg-ghost" />
        <span aria-hidden className="season-egg-bubble" data-show={talking && phase === "idle" ? "" : undefined}>
          {TAUNTS[taunt]}
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
