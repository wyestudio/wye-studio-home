"use client";

import { useEffect, useId, useRef } from "react";
import { SeasonArt } from "@/components/season/SeasonArt";
import { XMAS_SCENE_SVGS, type XmasSceneName } from "@/components/season/xmasSceneSvgs";

/**
 * 코드로 그린 배경 그림 한 장(언덕 · 눈밭). SeasonArt 와 같은 방식(페이지 안에 직접 그린다)이고, 그림만 xmasSceneSvgs.ts 에서 읽는다.
 * fit — 칸과 그림 비율이 다를 때 맞추는 법(SVG preserveAspectRatio).
 */
function Scene({ art, className, fit }: { art: XmasSceneName; className: string; fit?: string }) {
  // 그라데이션 id — 큰 나무를 양쪽에 두 번 그려도 서로 안 겹치게
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { viewBox, inner } = XMAS_SCENE_SVGS[art];
  const [, , w, h] = viewBox.split(" ").map(Number);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      preserveAspectRatio={fit}
      aria-hidden
      focusable="false"
      style={{ aspectRatio: `${w} / ${h}` }}
      className={`season-art ${className}`}
      // 내용은 저장소에 있는 고정 SVG 다(xmasSceneSvgs.ts). 사용자 입력이 섞이지 않는다.
      dangerouslySetInnerHTML={{ __html: inner.replaceAll("__ID__", `${uid}-`) }}
    />
  );
}

/** 일러스트 파일(public/season/christmas/<이름>.webp) — [이름, 가로, 세로]. 가로 · 세로는 비율만 알려 준다. */
const PICS = {
  village: ["xmas-village", 353, 290],
  grove: ["xmas-grove", 520, 486],
  snowman: ["xmas-snowman", 309, 289],
  rudolph: ["xmas-rudolph-stand", 234, 296],
  pine: ["xmas-pine", 781, 1100],
  sleigh: ["xmas-sleigh", 390, 257],
} as const;

/** 일러스트 한 장 — <img> 가 아니라 CSS 배경으로 깐다(SeasonArt.tsx 의 카카오톡 인앱 브라우저 건). */
function Pic({ pic, className }: { pic: keyof typeof PICS; className: string }) {
  const [file, w, h] = PICS[pic];
  return (
    <div
      className={`season-art season-pic ${className}`}
      style={{ aspectRatio: `${w} / ${h}`, backgroundImage: `url(/season/christmas/${file}.webp)` }}
    />
  );
}

/*
  산타 썰매 — 그림 한 장을 그대로 옮기기만 하면 종이 인형을 미는 것처럼 보인다. 그래서:
    1. 날아가는 길을 셋으로 나눠 겹친다 — 가로로 가로지르기(바깥) · 떠올랐다 내려오는 큰 곡선(arc) ·
       잘게 출렁이기(bob)
    2. 같은 그림을 두 장 겹쳐 고삐가 지나는 자리에서 나눈다(썰매 쪽 · 순록 쪽). 그 자리를 축으로
       서로 반대로 까딱여, 순록이 끌고 썰매가 따라 흔들리는 것처럼 보인다
    3. 썰매 뒤로 별가루가 생겼다 흩어진다
  전부 CSS 애니메이션이다(season.css 의 .xmas-sleigh-*).
*/
const DUST = [
  [4, 62, 0],
  [12, 78, 0.5],
  [1, 80, 0.9],
  [18, 66, 1.3],
  [8, 90, 0.3],
  [22, 84, 1.1],
] as const;

function Sleigh() {
  const [file, w, h] = PICS.sleigh;
  const bg = { backgroundImage: `url(/season/christmas/${file}.webp)` };
  return (
    <div className="xmas-bd-sleigh" style={{ aspectRatio: `${w} / ${h}` }}>
      <div className="xmas-sleigh-arc">
        <div className="xmas-sleigh-bob">
          <div className="season-art season-pic xmas-sleigh-part xmas-sleigh-part--sled" style={bg} />
          <div className="season-art season-pic xmas-sleigh-part xmas-sleigh-part--deer" style={bg} />
          {DUST.map(([left, top, delay], i) => (
            <span
              key={i}
              className="xmas-sleigh-dust"
              style={{ left: `${left}%`, top: `${top}%`, animationDelay: `-${delay}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/*
  내리는 눈 — 멀수록 작고 느리게, 가까울수록 크고 빠르고 흐릿하게(원근).
  [층 이름, 개수, 크기 최소·최대(px), 한 번 내리는 시간 최소·최대(초)]
  ⚠️ Math.random 을 쓰지 않는다 — 서버와 브라우저가 다른 값을 내면 React 가 어긋났다고 알린다.
*/
const SNOW_LAYERS: [string, number, number, number, number, number][] = [
  ["far", 18, 2, 3, 26, 38],
  ["mid", 11, 4, 6, 17, 24],
  ["near", 5, 9, 14, 10, 14],
];

/** 0~1 사이의 고르게 흩어진 값(황금비 수열). 같은 번호면 늘 같은 값. */
const spread = (i: number, salt: number) => (i * 0.618034 + salt * 0.37) % 1;

function Snow({ layer }: { layer: number }) {
  const [name, n, s0, s1, d0, d1] = SNOW_LAYERS[layer];
  return (
    <div className={`xmas-snow xmas-snow--${name}`}>
      {Array.from({ length: n }, (_, i) => {
        const size = Math.round(s0 + (s1 - s0) * spread(i, layer + 1));
        const dur = Math.round(d0 + (d1 - d0) * spread(i, layer + 4));
        return (
          <span
            key={i}
            style={{
              left: `${Math.round(spread(i, layer) * 1000) / 10}%`,
              width: size,
              height: size,
              animationDuration: `${dur}s`,
              animationDelay: `-${Math.round(dur * spread(i, layer + 7) * 10) / 10}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * 크리스마스 배경 — 눈 내리는 밤의 언덕 마을. 뒤에서 앞으로:
 * 달 → 먼 언덕 → 가운데 언덕과 숲 → 가까운 언덕과 마을 → 맨 앞 눈밭과 눈사람 · 선물 · 루돌프 →
 * 화면 양끝의 큰 트리(마스코트 장식이 달렸다). 멀수록 하늘색에 가깝고 가까울수록 밝고 또렷하다(원근).
 * 하늘에는 산타 썰매가 지나가고(홈), 헤더 아래에는 전구 줄과 리스가 걸린다.
 * 언덕 · 눈밭은 코드로 그린 매끈한 곡선이고, 그 위의 마을 · 나무 · 눈사람 · 루돌프 · 썰매는 일러스트 파일이다.
 * 위치 · 크기는 season.css 의 .xmas-bd-*.
 *
 * xmas-bd-floor — 바닥에 붙은 것 전부를 묶은 칸. 하단 고정 버튼 막대가 있으면 통째로 올리고,
 * 홈 밖에서는 통째로 연하게 누른다.
 * 할로윈처럼 화면에 고정돼 콘텐츠 **뒤**에 깔리고 클릭을 받지 않는다.
 *
 * 홈에서는 스크롤한 만큼(첫 장면이 넘어갈 때까지 0→1)을 --xmas-p 로 넣는다. season.css 가 그 값으로
 * 층마다 다른 거리만큼 내려 보낸다 — 가까운 것일수록 많이 움직여, 땅을 떠나 올라가는 것처럼 보인다.
 * ⚠️ 값 하나만 바꾸고 화면은 CSS 가 그린다. 여기서 서버를 부르거나 React 상태를 바꾸지 않는다
 *    (스크롤마다 다시 그리게 된다).
 */
export function ChristmasBackdrop({ isHome }: { isHome: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !isHome) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      // 첫 장면(히어로)이 다음 장면으로 넘어가는 구간 — ScrollStage 의 한 장면이 110vh 다
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 1.1)));
      el.style.setProperty("--xmas-p", p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      el.style.removeProperty("--xmas-p");
    };
  }, [isHome]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`season-only season-backdrop ${isHome ? "season-backdrop--home" : ""}`}
    >
      {/* 달 — 홈의 하늘에만 뜬다. 밝아서 본문이 있는 화면에서는 글자가 묻힌다 */}
      {isHome && <div className="xmas-bd-moon" />}
      <Snow layer={0} />
      {/* 산타 썰매 — 홈의 하늘을 가로지른다. 본문이 있는 화면에서는 글 뒤로 지나가 거슬린다 */}
      {isHome && <Sleigh />}
      <div className="xmas-bd-floor">
        <Scene art="hills-far" fit="xMidYMax slice" className="xmas-bd-far" />
        <Scene art="hills-mid" fit="xMidYMax slice" className="xmas-bd-mid" />
        <Pic pic="grove" className="xmas-bd-grove" />
        <Scene art="hills-near" fit="xMidYMax slice" className="xmas-bd-near" />
        <Pic pic="village" className="xmas-bd-village" />
        <Scene art="ground" fit="none" className="xmas-bd-ground" />
        <Pic pic="snowman" className="xmas-bd-props" />
        <Pic pic="rudolph" className="xmas-bd-rudolph" />
        <Pic pic="pine" className="xmas-bd-pine xmas-bd-pine--left" />
        <Pic pic="pine" className="xmas-bd-pine xmas-bd-pine--right" />
      </div>
      <Snow layer={1} />
      <Snow layer={2} />
      {/* 헤더 아래 전구 줄 — 그림은 CSS 배경(옆으로 이어 붙인다) */}
      <div className="xmas-bd-garland" />
      {/* 전구 줄에 걸린 리스 */}
      <SeasonArt art="xmas-wreath" className="xmas-bd-wreath" />
    </div>
  );
}
