import { Orbitron } from "next/font/google";

/**
 * 홈 행성 장면 제목 「Planets to Escape」 글꼴(Orbitron).
 * 다른 곳에서도 쓰게 되면 여기서 가져간다(따로 부르면 같은 글꼴을 두 번 내려받는다).
 * 홈에서만 쓰므로 사이트 레이아웃이 아니라 여기 둔다. 영문이라 latin 만 · 굵기 600 하나만.
 * Geist Mono · Space Grotesk 와 나란히 비교해 대표님이 골랐다.
 */
export const orbitron = Orbitron({ subsets: ["latin"], weight: "600", display: "swap" });
