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
        <SeasonArt art="castle-ground" className="season-bd-ground" />
        <SeasonArt art="pumpkin" className="season-bd-pumpkin" />
      </div>
      {/* 오른쪽 유령은 눌리는 이스터에그라 배경 밖(콘텐츠 앞)에 따로 띄운다. */}
      <GhostEasterEgg />
    </>
  );
}
