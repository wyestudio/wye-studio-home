/*
  시즌 장식 그림의 SVG 내용 — public/season/halloween/*.svg 를 그대로 옮겨 둔 것이다.
  SeasonArt 가 <img> 로 불러오지 않고 페이지 안에 직접 그린다(이유는 SeasonArt.tsx).

  ⚠️ 그림을 바꾸면 public 의 파일과 여기를 같이 고친다. 파일은 승인 시안 원본이고,
     화면이 실제로 그리는 것은 이쪽이다.
*/
import type { SeasonArtName } from "@/components/season/SeasonArt";

type ArtSvg = {
  viewBox: string;
  /** <svg> 에 붙어 있던 속성. 안쪽 도형이 currentColor 로 이 색을 쓴다. */
  attrs: { fill?: string; color?: string; stroke?: string; strokeWidth?: string };
  inner: string;
};

export const SEASON_ART_SVGS: Record<SeasonArtName, ArtSvg> = {
  "witch-hat": {
    viewBox: "0 0 110 75",
    attrs: { fill: "none", color: "#fff2d1" },
    inner: "<path d=\"M22 57 53 4 84 8 65 17 85 60\" fill=\"#170d27\" stroke=\"#b28cd4\" stroke-width=\"1.5\"></path><path d=\"m27 48 54 3 4 9-63-3\" fill=\"#8c4fbd\"></path><ellipse cx=\"53\" cy=\"62\" fill=\"#170d27\" rx=\"51\" ry=\"10\" stroke=\"#b28cd4\" stroke-width=\"1.5\"></ellipse><rect fill=\"none\" height=\"10\" rx=\"1\" stroke=\"#ffba4e\" stroke-width=\"3\" width=\"12\" x=\"50\" y=\"49\"></rect>",
  },
  "pumpkin": {
    viewBox: "0 0 140 120",
    attrs: { fill: "none", color: "#fff2d1" },
    inner: "<path d=\"M69 25q-9-22 11-23l4 9q-12-2-10 17\" fill=\"#a5a05c\"></path><ellipse cx=\"48\" cy=\"71\" fill=\"#ed7c22\" rx=\"38\" ry=\"43\"></ellipse><ellipse cx=\"92\" cy=\"71\" fill=\"#ed7c22\" rx=\"38\" ry=\"43\"></ellipse><ellipse cx=\"70\" cy=\"72\" fill=\"#ff9c29\" rx=\"35\" ry=\"46\"></ellipse><path d=\"M34 64l18-20 9 23zm45 3 10-23 18 20zM33 80l17 7 5-7 11 10 10-9 8 5 22-7q-31 47-73 1\" fill=\"#271330\"></path><path d=\"M59 82l10-12 9 12\" fill=\"#271330\"></path>",
  },
  "ghost": {
    viewBox: "0 0 90 110",
    attrs: { fill: "none", color: "#fff2d1" },
    inner: "<path d=\"M17 98V43C17 0 76 0 76 43v42q-6 22-17 10-11 15-20 1-10 16-22 2\" fill=\"#fff0dc\"></path><ellipse cx=\"38\" cy=\"46\" fill=\"#3a2352\" rx=\"5\" ry=\"8\"></ellipse><ellipse cx=\"59\" cy=\"46\" fill=\"#3a2352\" rx=\"5\" ry=\"8\"></ellipse><ellipse cx=\"49\" cy=\"63\" fill=\"#3a2352\" rx=\"5\" ry=\"6\"></ellipse><ellipse cx=\"29\" cy=\"59\" fill=\"#eab3bc\" rx=\"6\" ry=\"3\"></ellipse>",
  },
  "bat-orange": {
    viewBox: "0 0 110 60",
    attrs: { fill: "none", color: "#ffa94c" },
    inner: "<path d=\"M4 5Q22 28 43 25L47 12 55 20 63 12 67 25Q87 28 106 5L98 43Q86 31 78 47Q65 36 55 57Q45 36 32 47Q24 31 12 43Z\" fill=\"currentColor\"></path>",
  },
  "bat-dark": {
    viewBox: "0 0 110 60",
    attrs: { fill: "none", color: "#100c1b" },
    inner: "<path d=\"M4 5Q22 28 43 25L47 12 55 20 63 12 67 25Q87 28 106 5L98 43Q86 31 78 47Q65 36 55 57Q45 36 32 47Q24 31 12 43Z\" fill=\"currentColor\"></path>",
  },
  "moon": {
    viewBox: "0 0 200 200",
    attrs: {  },
    inner: "<circle cx=\"100\" cy=\"100\" fill=\"#ffce70\" r=\"94\"></circle><g fill=\"#e6a952\" opacity=\".5\"><circle cx=\"60\" cy=\"60\" r=\"20\"></circle><circle cx=\"138\" cy=\"105\" r=\"26\"></circle><circle cx=\"78\" cy=\"148\" r=\"14\"></circle></g>",
  },
  "corner-web-spider": {
    viewBox: "0 0 200 200",
    attrs: { fill: "none", stroke: "#d2aeed", strokeWidth: "1" },
    inner: "<path d=\"M0 0 200 0M0 0 190 65M0 0 150 150M0 0 65 190M0 0 0 200M40 0q-3 12-2 13-4 8-8 17-12 5-17 8-9 0-13 2M80 0q-9 20-4 26-12 11-16 34-23 4-34 16-6-5-26 4M120 0q-10 30-6 39-20 18-24 51-33 4-51 24-9-4-39 6M160 0q-12 40-8 52-25 22-32 68-46 7-68 32-12-4-52 8M200 0q-13 48-10 65-32 30-40 85-55 8-85 40-17-3-65 10\"></path><path d=\"M101 100v70\"></path><ellipse cx=\"101\" cy=\"174\" fill=\"#1a0d2b\" rx=\"5\" ry=\"7\"></ellipse><path d=\"m96 172-7-7m7 11-9 6m19-10 7-7m-7 11 9 6\" stroke=\"#1a0d2b\" stroke-width=\"2\"></path>",
  },
  "castle-ground": {
    viewBox: "0 0 1440 190",
    attrs: {  },
    inner: "<path d=\"M0 190V145q110-43 230 18 130-36 300 10 200-30 410-10 190-40 500-10v37\" fill=\"#100b1a\"></path><g fill=\"#100b1a\"><path d=\"M0 160V76l10-5-10-22 23 17 9-44 9 4-5 62 27-28 16-9-10 21-34 31 5 66zM1270 167V82h-12l30-43 26 43h-10v85m8 0v-47h-8l32-31 26 31h-9v47m23 0V65h-9l26-48 30 48h-12v103\"></path><path d=\"m1170 166 8-57-21-29 6-5 18 17 5-64 8-1 2 39 26-15 4 5-30 26 3 83\"></path></g><g fill=\"#ffb845\"><path d=\"M1280 97h8v15h-8zm96-10h9v15h-9zm-50 51h8v11h-8zm58-6h10v18h-10z\"></path></g>",
  },
  "poster-web": {
    viewBox: "0 0 100 100",
    attrs: { color: "#fff2d1", fill: "none", stroke: "currentColor", strokeWidth: ".8" },
    inner: "<path d=\"M0 0h100M0 0l95 32M0 0l75 75M0 0l32 95M0 0v100M25 0q-4 8-1 8-6 4-6 10-6 0-10 6-3-1-8 1M50 0q-5 12-2 16-11 8-11 21-13 0-21 11-4-3-16 2M75 0q-6 18-3 24-16 12-16 32-20 0-32 16-6-3-24 3M100 0q-8 24-5 32-21 16-20 43-27-1-43 20-8-3-32 5\"></path>",
  },
  "sparkle": {
    viewBox: "0 0 32 32",
    attrs: {  },
    inner: "<path d=\"M16 1Q17 14 31 16Q17 18 16 31Q14 18 1 16Q14 14 16 1Z\" fill=\"#ffbd61\"/>",
  },
};
