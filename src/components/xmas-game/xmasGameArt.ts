/**
 * 「산타의 어드벤트 캘린더」 캐릭터 그림 — 눈사람 · 루돌프 · 산타. 문 장식은 xmasGameDoors.ts.
 *
 * 승인 시안(2026-11-26)의 그림을 그대로 옮겼다. 전부 코드로 그린 SVG 문자열이라 내려받는 그림 파일이 없다.
 * ⚠️ 시즌 그림에 <img> 를 쓰지 않는다(카카오톡 인앱 브라우저) — 인라인 SVG 로만 넣는다.
 * ⚠️ 여기 글자(letter)는 XmasGame 이 넘기는 고정 글자뿐이다. 손님이 넣은 값을 이 문자열에 섞지 않는다.
 * ⚠️ 이 파일은 상세 페이지의 입구 카드도 쓴다(처음부터 내려받는다). 문 장식처럼 게임 창에서만 쓰는 그림은
 *    여기 두지 않는다.
 */

export type Kind = "snow" | "deer" | "santa";

export const cream = "#fff3d6";
export const red = "#cb4841";
export const gold = "#f1b74c";
export const green = "#246453";
export const mint = "#9bcbb6";

export const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
export const line = (d: string, color: string, w: number) =>
  path(d, "none", `stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`);
export const dot = (x: number, y: number, r: number, c: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
export const rect = (x: number, y: number, w: number, h: number, c: string, r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
export const svg = (viewBox: string, body: string) => `<svg aria-hidden="true" viewBox="${viewBox}">${body}</svg>`;

/**
 * 캐릭터 하나. letter 가 있으면 선물 상자에 그 글자를 적어 든다(산타만). hit 이면 눈이 >< 가 된다.
 */
export function characterSvg(kind: Kind, letter: string | null, hit: boolean): string {
  const snow = kind === "snow";
  const white = "#fff9e8";
  const brown = "#ad7143";
  const dark = "#492f28";
  let body = "";
  if (kind === "deer") {
    body =
      line("M40 37Q29 26 26 11m5 14-14-6m47 19q12-13 13-28m-5 15 14-7", "#75482e", 6) +
      path("M32 45Q7 24 16 48Q20 57 32 56M69 45Q94 24 85 48Q81 57 69 56", brown) +
      rect(31, 68, 40, 35, brown, 16) +
      rect(25, 30, 52, 48, brown, 23) +
      rect(32, 73, 38, 8, red, 4) +
      dot(51, 62, 7, red);
  } else {
    body = rect(22, 64, 58, 41, snow ? white : red, 21) + rect(23, 30, 55, 49, snow ? white : "#f4bd99", 24);
    if (!snow)
      body += path("M23 53Q34 66 45 59Q50 57 52 61Q58 55 65 59Q72 60 78 51Q81 79 53 87Q25 79 23 53", white);
    body +=
      path("M25 34Q36 7 54 12Q73 13 83 35Q67 25 59 26L70 33Z", red) + rect(24, 29, 49, 9, white, 4) + dot(83, 36, 6, white);
    if (snow)
      body += rect(26, 71, 50, 9, red, 5) + rect(59, 76, 10, 18, red, 4) + path("M49 55 64 58 49 61Z", "#ee9950") + dot(49, 89, 3, dark);
    else body += dot(51, 55, 5, "#ed9981");
  }
  body += hit ? line("M36 45l7 4-7 4m28-8-7 4 7 4", dark, 3.3) : dot(40, 49, 2.8, dark) + dot(61, 49, 2.8, dark);
  if (letter)
    body +=
      rect(34, 70, 41, 30, gold, 3) +
      rect(32, 67, 45, 6, red, 2) +
      line("M53 68q-17-15-14-5 2 5 14 5 16-16 14-6-2 6-14 6", red, 3) +
      `<text x="54" y="95" text-anchor="middle" font-family="inherit" font-weight="800" font-size="26" fill="#412c29">${letter}</text>` +
      dot(34, 80, 4, white) +
      dot(74, 80, 4, white);
  return svg("0 0 100 103", body);
}

/** 선물 상자 — 게이지 끝 · 목표 칸 · 교환권에 쓴다. 상세 페이지도 써서 여기(처음부터 받는 파일)에 둔다. */
export function giftSvg(): string {
  const bow = line("M50 34Q17 4 28 28Q32 36 50 34Q82 5 72 28Q66 37 50 34", red, 6);
  return svg("0 0 100 100", rect(21, 39, 59, 44, mint, 3) + rect(17, 31, 67, 15, green, 3) + rect(45, 31, 10, 52, red) + bow);
}

/** 작은 크리스마스트리 — 상세 페이지 블록 제목 옆에 세운다. 별 · 세 겹 잎 · 방울 · 밑동. */
export function treeSvg(): string {
  const leaf = "#2f9d6a";
  return svg(
    "0 0 100 100",
    rect(43, 82, 14, 14, "#8a5a3b", 3) +
      path("M50 44 92 86H8Z", "#23784f") +
      path("M50 26 84 64H16Z", "#288a5b") +
      path("M50 10 74 40H26Z", leaf) +
      path("M50 0l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8.1L50 18.5l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.1Z", gold) +
      dot(41, 36, 3.6, red) +
      dot(60, 56, 4, gold) +
      dot(36, 60, 4, cream) +
      dot(68, 78, 4.2, red) +
      dot(30, 80, 4, gold) +
      dot(50, 74, 3.6, cream),
  );
}
