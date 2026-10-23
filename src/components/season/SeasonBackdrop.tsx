"use client";

import { usePathname } from "next/navigation";
import { SeasonArt } from "@/components/season/SeasonArt";
import { GhostEasterEgg } from "@/components/season/GhostEasterEgg";

/**
 * 화면 가장자리 배경 장식 — 달 · 박쥐 · 거미줄 · 성 실루엣 · 호박 · 유령 · 별.
 * 화면에 고정돼 콘텐츠 **뒤**에 깔린다(별빛보다는 앞). 루트 레이아웃이 고객 화면
 * 전체에 단다(2026-10-21 대표님 — "모든 페이지 다 적용").
 *
 * ⚠️ 홈은 헤더가 투명이라 거미줄을 화면 맨 위 구석에 붙인다. 나머지는 불투명 헤더의
 *    아래 선(--header-bottom, Header.tsx)에 맞춘다(season.css).
 */
export function SeasonBackdrop() {
  const isHome = usePathname() === "/";
  return (
    <>
      <div
        aria-hidden
        className={`season-only season-backdrop ${isHome ? "season-backdrop--home" : ""}`}
      >
        <SeasonArt art="moon" className="season-bd-moon" />
        <SeasonArt art="bat-dark" className="season-bd-bat season-bd-bat--1" />
        <SeasonArt art="bat-dark" className="season-bd-bat season-bd-bat--2" />
        <SeasonArt art="corner-web-spider" className="season-bd-web" />
        <SeasonArt
          art="sparkle"
          className="season-bd-spark season-bd-spark--1"
        />
        <SeasonArt
          art="sparkle"
          className="season-bd-spark season-bd-spark--2"
        />
        {/*
          성 실루엣은 칸을 꽉 채우고 아래에 붙인다(cover). 넓은 화면은 가운데, 좁은 화면은 성이
          있는 오른쪽을 남긴다 — 화면 폭마다 맞춤이 달라 두 장을 두고 season.css 가 하나만 보인다.
        */}
        <SeasonArt
          art="castle-ground"
          fit="xMidYMax slice"
          className="season-bd-ground season-bd-ground--wide"
        />
        <SeasonArt
          art="castle-ground"
          fit="xMaxYMax slice"
          className="season-bd-ground season-bd-ground--narrow"
        />
        <SeasonArt art="pumpkin" className="season-bd-pumpkin" />
      </div>
      {/* 오른쪽 유령은 눌리는 이스터에그라 배경 밖(콘텐츠 앞)에 따로 띄운다. */}
      <GhostEasterEgg />
    </>
  );
}
