/*
  시즌 장식 그림의 SVG 내용 — public/season/halloween/*.svg · public/season/christmas/*.svg 를
  그대로 옮겨 둔 것이다.
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
  // ── 크리스마스 — public/season/christmas/*.svg (GPT 시안 패키지 WYE_Christmas_v2, 호랑가시 · 반짝이는 첫 패키지) ──
  "xmas-santa-hat": {
    viewBox: "0 0 210 170",
    attrs: {  },
    inner: "<defs><linearGradient id=\"__ID__red\" x2=\".8\" y2=\"1\"><stop stop-color=\"#F96163\"/><stop offset=\"1\" stop-color=\"#A51F37\"/></linearGradient></defs><path d=\"M26 114Q54 24 121 10Q150 2 167 43Q177 67 192 57\" fill=\"url(#__ID__red)\" stroke=\"#6A2236\" stroke-width=\"4\"/><ellipse cx=\"191\" cy=\"59\" rx=\"17\" ry=\"17\" fill=\"#F7F6FF\"/><path d=\"M18 113Q104 90 156 122L156 141Q87 121 24 144Z\" fill=\"#F3F3FF\" stroke=\"#CFDEF3\" stroke-width=\"4\"/>",
  },
  "xmas-gift": {
    viewBox: "0 0 120 120",
    attrs: {  },
    inner: "<rect x=\"15\" y=\"46\" width=\"90\" height=\"62\" rx=\"3\" fill=\"#D93F50\"/><rect x=\"10\" y=\"37\" width=\"100\" height=\"23\" rx=\"3\" fill=\"#F25F63\"/><path d=\"M51 37H69V108H51Z\" fill=\"#F8D976\"/><path d=\"M10 49H110\" stroke=\"#FFF0AD\" stroke-width=\"4\"/><path d=\"M59 36C2 28 40-2 59 34C85-3 121 28 59 36Z\" fill=\"none\" stroke=\"#FFD86E\" stroke-width=\"9\"/>",
  },
  "xmas-holly": {
    viewBox: "0 0 160 140",
    attrs: {  },
    inner: "<path d=\"M70 58q-48-45-62-17Q-3 77 57 72q-28 47 2 48 30 0 24-52 56 31 67 1 9-27-40-27Z\" fill=\"#197b59\" stroke=\"#0c4e3b\" stroke-width=\"4\"/><circle cx=\"75\" cy=\"65\" r=\"15\" fill=\"#df4a58\"/><circle cx=\"91\" cy=\"80\" r=\"13\" fill=\"#c73548\"/><circle cx=\"61\" cy=\"83\" r=\"13\" fill=\"#e85e63\"/>",
  },
  "xmas-star": {
    viewBox: "0 0 100 100",
    attrs: {  },
    inner: "<defs><radialGradient id=\"__ID__g\"><stop stop-color=\"#FFFED1\"/><stop offset=\".4\" stop-color=\"#FFD66E\"/><stop offset=\"1\" stop-color=\"#E69B36\"/></radialGradient><filter id=\"__ID__s\"><feGaussianBlur stdDeviation=\"4\"/></filter></defs><path d=\"M50 4L61 37L95 50L61 62L50 96L38 62L5 50L38 37Z\" fill=\"#FFC75E\" opacity=\".5\" filter=\"url(#__ID__s)\"/><path d=\"M50 7L61 38L93 50L61 61L50 93L39 61L7 50L39 38Z\" fill=\"url(#__ID__g)\"/>",
  },
  "xmas-sparkle": {
    viewBox: "0 0 90 90",
    attrs: {  },
    inner: "<path d=\"M45 4 52 37 86 45 52 53 45 86 37 53 4 45 37 37Z\" fill=\"#ffcf83\"/><path d=\"M45 23v44M23 45h44\" stroke=\"#fff5d8\" stroke-width=\"2\"/>",
  },
  "xmas-snowflake": {
    viewBox: "0 0 120 120",
    attrs: {  },
    inner: "<g stroke=\"#EAF5FF\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M60 6V114M6 60H114M22 22L98 98M98 22L22 98\"/><path d=\"M48 16L60 28L72 16M48 104L60 92L72 104M16 48L28 60L16 72M104 48L92 60L104 72M28 18L30 35L18 28M92 102L90 85L102 92M102 28L85 30L92 18M18 92L35 90L28 102\"/></g><circle cx=\"60\" cy=\"60\" r=\"5\" fill=\"#FFFFFF\"/>",
  },
  "xmas-snowflake-2": {
    viewBox: "0 0 64 64",
    attrs: {  },
    inner: "<g stroke=\"#D9E8FF\" stroke-width=\"3\" stroke-linecap=\"round\"><path d=\"M32 5V59M5 32H59M13 13L51 51M51 13L13 51\"/><path d=\"M24 11L32 19L40 11M24 53L32 45L40 53M11 24L19 32L11 40M53 24L45 32L53 40\"/></g>",
  },
  "xmas-drift": {
    viewBox: "0 0 1920 250",
    attrs: {  },
    inner: "<defs><linearGradient id=\"__ID__snow\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop stop-color=\"#D0CCF6\"/><stop offset=\".25\" stop-color=\"#AFB9ED\"/><stop offset=\".64\" stop-color=\"#787EBD\"/><stop offset=\"1\" stop-color=\"#454D88\"/></linearGradient><linearGradient id=\"__ID__top\" x1=\"0\" x2=\"0\" y1=\"0\" y2=\"1\"><stop stop-color=\"#EDF1FF\"/><stop offset=\"1\" stop-color=\"#A0A7D8\"/></linearGradient></defs><path d=\"M0 122C180 90 300 112 455 135C600 158 740 92 930 122C1080 142 1130 120 1300 104C1510 83 1710 133 1920 117V250H0Z\" fill=\"url(#__ID__snow)\"/><path d=\"M0 121C170 94 338 110 455 135C620 162 755 90 929 121C1111 152 1201 105 1340 102C1599 80 1716 132 1920 117\" fill=\"none\" stroke=\"#F5F4FF\" stroke-width=\"5\" opacity=\".55\"/><path d=\"M0 185Q260 152 520 181T1050 168T1920 187V250H0Z\" fill=\"#4F558B\" opacity=\".32\"/>",
  },
  "xmas-pines-far": {
    viewBox: "0 0 960 190",
    attrs: {  },
    inner: "<g><g transform=\"translate(45 120)\"><path d=\"M0 65V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-20.8 39.6L-13.0 37.0L-27.9 57.2H27.9L13.0 37.0L20.8 39.6Z\" fill=\"#373E75\"/><path d=\"M0 5L-18.2 38.4Q0 27.9 18.2 38.4\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(115 85)\"><path d=\"M0 100V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-32.0 61.0L-20.0 57.0L-43.0 88.0H43.0L20.0 57.0L32.0 61.0Z\" fill=\"#373E75\"/><path d=\"M0 5L-28.0 59.0Q0 43.0 28.0 59.0\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(200 115)\"><path d=\"M0 70V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-22.4 42.7L-14.0 39.9L-30.1 61.6H30.1L14.0 39.9L22.4 42.7Z\" fill=\"#373E75\"/><path d=\"M0 5L-19.6 41.3Q0 30.1 19.6 41.3\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(310 59)\"><path d=\"M0 126V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-40.3 76.9L-25.2 71.8L-54.2 110.9H54.2L25.2 71.8L40.3 76.9Z\" fill=\"#373E75\"/><path d=\"M0 5L-35.3 74.3Q0 54.2 35.3 74.3\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(445 109)\"><path d=\"M0 76V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-24.3 46.4L-15.2 43.3L-32.7 66.9H32.7L15.2 43.3L24.3 46.4Z\" fill=\"#373E75\"/><path d=\"M0 5L-21.3 44.8Q0 32.7 21.3 44.8\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(510 72)\"><path d=\"M0 113V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-36.2 68.9L-22.6 64.4L-48.6 99.4H48.6L22.6 64.4L36.2 68.9Z\" fill=\"#373E75\"/><path d=\"M0 5L-31.6 66.7Q0 48.6 31.6 66.7\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(605 100)\"><path d=\"M0 85V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-27.2 51.9L-17.0 48.4L-36.5 74.8H36.5L17.0 48.4L27.2 51.9Z\" fill=\"#373E75\"/><path d=\"M0 5L-23.8 50.1Q0 36.5 23.8 50.1\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(755 55)\"><path d=\"M0 130V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-41.6 79.3L-26.0 74.1L-55.9 114.4H55.9L26.0 74.1L41.6 79.3Z\" fill=\"#373E75\"/><path d=\"M0 5L-36.4 76.7Q0 55.9 36.4 76.7\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(875 96)\"><path d=\"M0 89V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-28.5 54.3L-17.8 50.7L-38.3 78.3H38.3L17.8 50.7L28.5 54.3Z\" fill=\"#373E75\"/><path d=\"M0 5L-24.9 52.5Q0 38.3 24.9 52.5\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g><g transform=\"translate(935 118)\"><path d=\"M0 67V7\" stroke=\"#393B6B\" stroke-width=\"4\"/><path d=\"M0 0L-21.4 40.9L-13.4 38.2L-28.8 59.0H28.8L13.4 38.2L21.4 40.9Z\" fill=\"#373E75\"/><path d=\"M0 5L-18.8 39.5Q0 28.8 18.8 39.5\" fill=\"none\" stroke=\"#858DC6\" stroke-width=\"4\"/></g></g>",
  },
  "xmas-lights": {
    viewBox: "0 0 1200 160",
    attrs: {  },
    inner: "<defs><radialGradient id=\"__ID__bulb\"><stop stop-color=\"#FFF7B4\"/><stop offset=\".35\" stop-color=\"#FFD070\"/><stop offset=\"1\" stop-color=\"#F6A845\"/></radialGradient><filter id=\"__ID__glow\"><feGaussianBlur stdDeviation=\"7\"/></filter></defs><path d=\"M5 12Q600 220 1195 12\" fill=\"none\" stroke=\"#665470\" stroke-width=\"3\"/><g><g transform=\"translate(90 53.070000000000014)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(180 87.48)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(270 115.23)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(360 136.32)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(450 150.75)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(540 158.52)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(630 159.63)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(720 154.07999999999998)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(810 141.87)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(900 123.0)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(990 97.46999999999998)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(1080 65.27999999999997)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g><g transform=\"translate(1170 26.430000000000007)\"><line y2=\"10\" stroke=\"#887077\" stroke-width=\"3\"/><circle cy=\"19\" r=\"19\" fill=\"#F6A943\" opacity=\".38\" filter=\"url(#__ID__glow)\"/><circle cy=\"18\" r=\"9\" fill=\"url(#__ID__bulb)\"/></g></g>",
  },
};
