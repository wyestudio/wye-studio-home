"use client";

import { usePathname } from "next/navigation";
import { SeasonArt } from "@/components/season/SeasonArt";
import { GhostEasterEgg } from "@/components/season/GhostEasterEgg";
import { useSiteSkin } from "@/components/season/SeasonContext";

/** 내리는 눈송이 — 왼쪽 위치(%) · 크기(px) · 한 번 내리는 시간(초) · 시작 지연(초). 적게, 느리게(시안). */
const SNOW: [number, number, number, number][] = [
  [4, 3, 26, -2], [11, 2, 31, -17], [19, 4, 24, -9], [27, 2, 34, -25], [36, 3, 29, -4],
  [45, 2, 33, -21], [54, 3, 27, -13], [63, 2, 35, -6], [71, 4, 25, -19], [79, 2, 30, -11],
  [86, 3, 28, -27], [94, 2, 32, -8],
];

/** 가장자리에 떠 있는 눈송이 — 그림 · 칸 이름. 위치 · 크기는 season.css 의 .xmas-bd-flake--N */
const FLAKES = [
  "xmas-snowflake", "xmas-snowflake-2", "xmas-snowflake", "xmas-snowflake-2",
  "xmas-snowflake", "xmas-snowflake-2", "xmas-snowflake-2", "xmas-snowflake",
] as const;

/**
 * 크리스마스 배경 — 시안(WYE_Christmas_v2)의 겨울 마을. 아래부터 먼 숲 → 왼쪽 트리 · 선물,
 * 오른쪽 오두막 · 눈사람 · 가로등 → 맨 앞 눈 언덕. 가장자리 눈송이, 천천히 내리는 작은 눈,
 * 홈 밖에서는 왼쪽 위 전구 줄. 위치 · 크기는 season.css 의 .xmas-bd-* 에 있다.
 * xmas-bd-floor — 바닥에 붙은 것들. 하단 고정 버튼 막대가 있으면 같이 위로 올린다.
 * 할로윈처럼 화면에 고정돼 콘텐츠 **뒤**에 깔리고 클릭을 받지 않는다.
 *
 * 트리 · 오두막은 그린 그림(래스터)이라 SVG 가 아니라 <img> 다. 크리스마스일 때만 그려지므로
 * 시즌이 꺼지면 받지도 않는다. 오두막은 시안이 배경째 잘라 준 것이라 하늘을 투명으로 빼서 넣었다.
 * next/image 로 바꾸지 않는다 — 이미 줄여 둔 webp 라 Vercel 이미지 변환 한도만 쓴다.
 */
function ChristmasBackdrop({ isHome }: { isHome: boolean }) {
  return (
    <div aria-hidden className={`season-only season-backdrop ${isHome ? "season-backdrop--home" : ""}`}>
      <div className="xmas-snow">
        {SNOW.map(([left, size, dur, delay], i) => (
          <span
            key={i}
            style={{ left: `${left}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
          />
        ))}
      </div>
      <SeasonArt art="xmas-lights" fit="xMinYMin meet" className="xmas-bd-lights" />
      {FLAKES.map((art, i) => (
        <SeasonArt key={i} art={art} className={`xmas-bd-flake xmas-bd-flake--${i + 1}`} />
      ))}
      {/* 먼 숲은 화면 4분의 1씩 네 장 — 한 장을 늘이면 나무가 옆으로 퍼지고 너무 가까워 보인다 */}
      {[0, 1, 2, 3].map((i) => (
        <SeasonArt key={i} art="xmas-pines-far" className={`xmas-bd-floor xmas-bd-pines xmas-bd-pines--${i + 1}`} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/season/christmas/xmas-tree-presents.webp"
        srcSet="/season/christmas/xmas-tree-presents-440.webp 440w, /season/christmas/xmas-tree-presents.webp 860w"
        sizes="(max-width: 767px) 220px, 430px"
        alt=""
        decoding="async"
        className="season-art xmas-bd-floor xmas-bd-tree"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/season/christmas/xmas-cabin-scene.webp"
        alt=""
        decoding="async"
        className="season-art xmas-bd-floor xmas-bd-cabin"
      />
      <SeasonArt art="xmas-drift" fit="none" className="xmas-bd-floor xmas-bd-ground" />
    </div>
  );
}

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
  if (useSiteSkin() === "christmas") return <ChristmasBackdrop isHome={isHome} />;
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
