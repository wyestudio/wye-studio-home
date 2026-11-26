import { cream, dot, giftSvg, gold, green, line, mint, path, rect, red, svg } from "./xmasGameArt";

/**
 * 「산타의 어드벤트 캘린더」 문 25장 — 색 · 장식 그림 11종. 게임 창에서만 쓴다(늦게 내려받는다).
 * 승인 시안(2026-11-26)의 그림을 그대로 옮겼다.
 */

/** 정답 화면에 흩날리는 색종이 색. */
export const CONFETTI = [gold, red, mint];

const star = path("M50 9 59 34 86 36 65 53 72 80 50 65 28 80 35 53 14 36 41 34Z", gold);
const bow = line("M50 34Q17 4 28 28Q32 36 50 34Q82 5 72 28Q66 37 50 34", red, 6);
const tree =
  rect(45, 74, 10, 15, "#855535") +
  path("M50 8 28 39H36L20 59H31L13 78Q50 90 87 78L69 59H80L64 39H73Z", green) +
  dot(43, 43, 3, gold) +
  dot(59, 60, 4, red) +
  dot(38, 71, 4, cream);
const sock =
  path("M39 20H73V58Q76 75 60 80L39 89Q20 94 16 80Q13 68 28 61L39 56Z", red) +
  rect(35, 15, 42, 15, cream, 4) +
  line("M45 40l6 5 6-5 6 5 6-5", cream, 3);
const ornament =
  line("M50 0v20", green, 2) +
  rect(44, 19, 12, 9, gold, 2) +
  dot(50, 53, 28, red) +
  line("M25 46q12 10 25 0t25 0 M24 57q13 10 26 0t26 0", cream, 3);
const gift = rect(21, 39, 59, 44, mint, 3) + rect(17, 31, 67, 15, green, 3) + rect(45, 31, 10, 52, red) + bow;
const candle =
  rect(37, 41, 27, 45, cream, 3) +
  path("M50 11Q31 36 49 38Q67 34 50 11", gold) +
  line("M38 56l24-11M38 72l24-11", red, 4);
const candy =
  line("M32 81 56 23Q66 4 78 22Q81 29 75 36", cream, 14) +
  line("M32 81 56 23Q66 4 78 22Q81 29 75 36", red, 14).replace("/>", ' stroke-dasharray="8 12"/>');
const wreath =
  Array.from({ length: 15 }, (_, i) =>
    dot(50 + 25 * Math.cos(i * 0.419), 54 + 26 * Math.sin(i * 0.419), 10, i % 2 ? green : "#42816a"),
  ).join("") +
  dot(30, 68, 4, red) +
  dot(72, 42, 4, red) +
  bow;
const mitten =
  path("M32 59Q15 41 22 35Q28 29 37 40L42 23Q48 6 61 13Q81 20 74 43L63 71Z", gold) +
  path("M32 57 66 68 60 83 26 72Z", green) +
  line("M44 39l15 6m-5-12-5 16", cream, 3);
const bell =
  path("M18 70Q32 55 32 39Q34 19 50 19Q69 19 70 39Q70 57 83 70Q51 80 18 70", gold) + dot(51, 77, 6, red) + bow;
const cup =
  path("M20 38H72V56Q71 80 48 80Q23 79 20 55Z", green) +
  line("M72 41Q95 35 84 56Q79 63 70 61", green, 6) +
  line("M32 48l8 7 8-7 8 7 8-7", cream, 3) +
  line("M39 29q-5-6 0-12m14 12q-5-6 0-12", cream, 3);

/** 문에 그리는 장식 11종. 문 번호로 고른다(doorArt). */
const DOOR_ARTS = [sock, gift, tree, ornament, candy, mitten, cup, wreath, bell, candle, star];

/** 문 25장의 색(바탕, 글자) — 일곱 가지를 돌려 쓴다. */
const DOOR_COLORS: [string, string][] = [
  ["#efb0a1", "#713d32"],
  ["#b8d8c2", green],
  ["#226052", cream],
  ["#f1c56c", "#704b27"],
  ["#bf4a40", cream],
  ["#fae8c8", green],
  ["#86beb2", "#164c41"],
];

/** 두 칸짜리 문 — 6×5 판에 25장을 채우려고 다섯 장은 넓다. */
const WIDE_DOORS = [2, 5, 13, 16, 24];

export const DOORS = Array.from({ length: 25 }, (_, i) => {
  const [bg, ink] = DOOR_COLORS[(i * 3 + Math.floor(i / 5)) % 7];
  return {
    bg,
    ink,
    wide: WIDE_DOORS.includes(i),
    art: svg("0 0 100 100", DOOR_ARTS[(i * 7 + Math.floor(i / 11)) % 11]),
  };
});

/** 선물 상자 — 게이지 끝 · 안내 · 선물 코드에 쓴다(그림은 xmasGameArt 의 것과 같다). */
export const GIFT_SVG = giftSvg();
