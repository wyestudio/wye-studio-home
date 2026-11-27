import { Jua } from "next/font/google";

/**
 * 주아 — 「산타의 어드벤트 캘린더」 의 제목 · 숫자 · 버튼 글꼴(2026-11-26 대표님: "기본 글꼴만 쓰니 만든 티가 안 난다").
 * 둥글고 통통해서 달력 그림과 결이 맞는다. 본문은 그대로 SUIT 다.
 *
 * 쓰는 곳 둘이 같은 선언을 나눠 쓴다 — 게임 화면의 레이아웃(src/app/santa-calendar)과 상세 페이지의 이벤트 블록
 * (XmasGameSection). `jua.variable` 을 붙인 요소 아래에서 --font-jua 가 살아나고, xmasScene.module.css 의
 * --x-display 가 그것을 집는다.
 *
 * ⚠️ 굵기가 하나뿐이다. 이 글꼴을 쓰는 곳에는 font-extrabold 를 붙이지 않는다 — 붙이면 브라우저가 억지로 굵게 그려 뭉개진다.
 * ⚠️ 한글 글꼴이라 조각이 많다(120개쯤). 미리 받지 않고(preload: false) 화면에 나온 글자의 조각만 받는다.
 *    다만 조각 목록(CSS)은 이 파일을 import 한 화면에 늘 실린다 — 이벤트가 끝나면 상세 페이지에서 블록과 함께 걷어낸다.
 */
export const jua = Jua({ weight: "400", subsets: ["latin"], variable: "--font-jua", display: "swap", preload: false });
