import { Creepster, Henny_Penny } from "next/font/google";

/*
  시즌 장식용 영문 글꼴. 쓰는 화면이 적어 preload 하지 않는다(모든 페이지가 받게 된다).
  ⚠️ next/font 는 같은 글꼴을 두 곳에서 따로 부르면 두 벌을 만든다. 여기서 한 번만 부른다.
*/

/** 녹아내리는 공포체 — BOO!(GhostEasterEgg). */
export const creepster = Creepster({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });

/**
 * 귀여운 할로윈체 — 테마 상세 이벤트 섹션의 'Halloween Event'.
 * Creepster 는 여기 쓰기엔 너무 무서웠다(2026-10-22 대표님).
 */
export const hennyPenny = Henny_Penny({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
