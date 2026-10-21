import { Creepster } from "next/font/google";

/*
  녹아내리는 공포체 — BOO!(GhostEasterEgg) · 'Halloween Event'(테마 상세 이벤트 섹션)에 쓴다.
  ⚠️ preload 하지 않는다 — 쓰는 화면이 적은데 모든 페이지가 받게 된다.
  ⚠️ next/font 는 같은 글꼴을 두 곳에서 따로 부르면 두 벌을 만든다. 여기서 한 번만 부른다.
*/
export const creepster = Creepster({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
