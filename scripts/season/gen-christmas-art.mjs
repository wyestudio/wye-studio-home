/*
  크리스마스 스킨에서 **코드로 그리는 그림**을 만든다 — 배경의 언덕 세 겹과 맨 앞 눈밭, 포스터 눈 지붕,
  반짝이, 헤더 아래 전구 줄. 매끈한 곡선뿐이라 손으로 그릴 것이 없고, 화면 폭에 맞춰 늘려도 안 깨진다.
  그림을 고치려면 여기를 고치고 다시 돌린다.

    node scripts/season/gen-christmas-art.mjs                  저장소의 세 곳에 쓴다
    node scripts/season/gen-christmas-art.mjs --preview <폴더>  낱장 SVG 로만 뽑는다(저장소는 안 건드린다)

  쓰는 곳:
    src/components/season/seasonArtSvgs.ts    작은 장식 — 크리스마스 칸만 갈아 끼운다
    src/components/season/xmasSceneSvgs.ts    배경의 언덕 · 눈밭
    public/season/christmas/garland*.svg      CSS 가 url() 로 쓰는 전구 줄

  일러스트(마을 · 숲 · 눈사람 · 루돌프 · 큰 나무 · 썰매 · 모자 · 선물 · 호랑가시 · 리스 · 방울)는 여기서 만들지 않는다.
  public/season/christmas/xmas-*.webp 가 원본이고(대표님이 주신 그림을 잘라 넣었다), 아래 RASTER 에는
  그 파일의 크기만 적는다 — **그림 파일을 바꾸면 RASTER 의 가로 · 세로도 같이 고치고 다시 돌린다.**
*/
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const r = (n) => Math.round(n * 10) / 10;

// 고정 난수 — 돌릴 때마다 같은 그림
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 색 ──
const C = {
  far: "#212a61",
  farRim: "#293472",
  farTree: "#182052",
  mid: "#2f3a7e",
  midRim: "#3c4893",
  near: "#505daa",
  nearRim: "#6b78c4",
  front: "#b7c2f3",
  frontRim: "#eef2ff",
  frontSh1: "#9ba8e6",
  frontSh2: "#8492d6",
  snow: "#f1f4ff",
  snowSh: "#bcc7f3",
  red: "#e5484d",
  greenHi: "#3fb486",
  goldHi: "#ffe6ab",
  warm: "#ffd27a",
};

// ── 언덕: 점들을 지나는 부드러운 곡선 ──
function spline(pts) {
  // Catmull-Rom → cubic bezier
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}
function yAt(pts, x) {
  // 곡선 위 x 에서의 y (촘촘히 잘라 찾는다)
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    if (x < p1[0] || x > p2[0]) continue;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    let best = p1[1], bd = 1e9;
    for (let t = 0; t <= 1; t += 0.01) {
      const u = 1 - t;
      const bx = u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0];
      const by = u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1];
      if (Math.abs(bx - x) < bd) { bd = Math.abs(bx - x); best = by; }
    }
    return best;
  }
  return pts[pts.length - 1][1];
}
function hill(pts, W, H, fill, rim, rimW = 5) {
  const top = spline(pts);
  const body = spline(pts.map(([x, y]) => [x, y + rimW]));
  return `<path d="${top}V${H}H0Z" fill="${rim}"/><path d="${body}V${H}H0Z" fill="${fill}"/>`;
}

// ── 먼 나무의 한 단(삼각형, 옆선이 살짝 휜다) ──
function tierPath(cx, y0, w, h, s, scallop, rnd) {
  const hw = (w / 2) * s, hh = h * s;
  const lx = cx - hw, rx = cx + hw, by = y0 + hh;
  const cy = y0 + hh * 0.66, cdx = hw * 0.3;
  let d = `M${r(cx)} ${r(y0)}Q${r(cx - cdx)} ${r(cy)} ${r(lx)} ${r(by)}`;
  if (!scallop) d += `Q${r(cx)} ${r(by + hh * 0.12)} ${r(rx)} ${r(by)}`;
  else {
    const seg = (rx - lx) / scallop;
    for (let i = 0; i < scallop; i++) {
      const dep = seg * (0.34 + (rnd ? rnd() * 0.3 : 0.15));
      d += `q${r(seg / 2)} ${r(dep)} ${r(seg)} 0`;
    }
  }
  d += `Q${r(cx + cdx)} ${r(cy)} ${r(cx)} ${r(y0)}Z`;
  return d;
}
/** tiers: 위에서부터 [apexY, width, height]. 아래 단부터 그린다. */
const arts = {};

// 일러스트 파일(public/season/christmas/<이름>.webp) — [가로, 세로]. 작은 장식 칸에 주소와 비율만 적어 넣는다.
const RASTER = {
  "xmas-santa-hat": [312, 220],
  "xmas-gift": [229, 246],
  "xmas-holly": [300, 226],
  "xmas-wreath": [302, 328],
  "xmas-bells": [286, 226],
  "xmas-rudolph": [273, 292],
};

// ════ 먼 언덕 ════
{
  const W = 1920, H = 300;
  const pts = [[0, 132], [230, 96], [520, 150], [800, 112], [1090, 164], [1350, 108], [1630, 146], [1920, 92]];
  let s = hill(pts, W, H, C.far, C.farRim, 4);
  // 아주 작은 나무 몇 그루 — 세 무리
  const rnd = rng(11);
  const spots = [150, 196, 262, 318, 842, 1296, 1340, 1392, 1452, 1790, 1838];
  let trees = "";
  for (const x of spots) {
    const hh = 34 + rnd() * 30;
    const y = yAt(pts, x) + 8;
    trees += `<path d="${tierPath(x, y - hh, hh * 0.44, hh * 0.62, 1, 0)}"/><path d="${tierPath(x, y - hh * 0.62, hh * 0.6, hh * 0.62, 1, 0)}"/>`;
  }
  s += `<g fill="${C.farTree}">${trees}</g>`;
  arts["xmas-hills-far"] = { viewBox: `0 0 ${W} ${H}`, inner: s };
}

// ════ 가운데 언덕 ════
const MID = [[0, 62], [300, 116], [640, 78], [980, 136], [1300, 92], [1610, 54], [1920, 98]];
{
  const W = 1920, H = 240;
  arts["xmas-hills-mid"] = { viewBox: `0 0 ${W} ${H}`, inner: hill(MID, W, H, C.mid, C.midRim, 5) };
}

// ════ 가까운 언덕 ════
{
  const W = 1920, H = 180;
  const pts = [[0, 86], [340, 44], [760, 92], [1150, 62], [1520, 98], [1920, 48]];
  arts["xmas-hills-near"] = { viewBox: `0 0 ${W} ${H}`, inner: hill(pts, W, H, C.near, C.nearRim, 5) };
}

// ════ 맨 앞 눈밭 ════
{
  const W = 1920, H = 150;
  const pts = [[0, 34], [300, 58], [700, 30], [1100, 62], [1500, 36], [1920, 56]];
  let s = hill(pts, W, H, C.front, C.frontRim, 6);
  const sh1 = [[0, 92], [420, 72], [900, 104], [1380, 78], [1920, 100]];
  const sh2 = [[0, 128], [520, 112], [1040, 136], [1560, 114], [1920, 130]];
  s += `<path d="${spline(sh1)}V${H}H0Z" fill="${C.frontSh1}"/><path d="${spline(sh2)}V${H}H0Z" fill="${C.frontSh2}"/>`;
  arts["xmas-ground"] = { viewBox: `0 0 ${W} ${H}`, inner: s };
}

// ════ 작은 장식 ════
// 반짝이
arts["xmas-sparkle"] = {
  viewBox: "0 0 32 32",
  inner: `<path d="M16 1Q17 14 31 16Q17 18 16 31Q14 18 1 16Q14 14 16 1Z" fill="${C.goldHi}"/>`,
};
// 눈 지붕 — 포스터 위에 얹는 눈. 옆으로 늘여 쓴다.
{
  const W = 400, H = 40;
  const rnd = rng(8);
  let d = `M0 14Q0 2 12 2H${W - 12}Q${W} 2 ${W} 14`;
  // 오른쪽에서 왼쪽으로 녹아내린 아랫선
  d += `V${r(20)}`;
  const n = 11, seg = W / n;
  for (let i = 0; i < n; i++) {
    const dep = 6 + rnd() * 14;
    d += `q${r(-seg * 0.25)} ${r(dep)} ${r(-seg * 0.5)} ${r(dep * 0.1)}q${r(-seg * 0.25)} ${r(-dep * 0.5)} ${r(-seg * 0.5)} ${r(-dep * 0.1)}`;
  }
  d += "Z";
  arts["xmas-snowcap"] = {
    viewBox: `0 0 ${W} ${H}`,
    inner: `<path d="${d}" fill="${C.snowSh}" transform="translate(0 3)"/><path d="${d}" fill="${C.snow}"/>`,
  };
}

// ════ 헤더 아래 전구 줄 (옆으로 이어 붙이는 한 칸) ════
const tiles = {};
{
  const W = 240, H = 64;
  const cols = [C.red, C.warm, C.greenHi, "#fff3d6", "#6fb7ff"];
  const at = (t) => [W * t, 5 + 72 * t * (1 - t)];
  const ts = [0.1, 0.3, 0.5, 0.7, 0.9];
  let base = `<path d="M0 5Q${W / 2} 41 ${W} 5" fill="none" stroke="#5a5a8c" stroke-width="1.6"/>`;
  ts.forEach((t, i) => {
    const [x, y] = at(t);
    base += `<rect x="${r(x - 2.5)}" y="${r(y - 0.5)}" width="5" height="5" rx="1" fill="#2b2a4f"/><ellipse cx="${r(x)}" cy="${r(y + 10)}" rx="4.6" ry="6.4" fill="${cols[i]}"/><ellipse cx="${r(x - 1.4)}" cy="${r(y + 8)}" rx="1.3" ry="2.2" fill="#fff" opacity=".55"/>`;
  });
  const halo = (idx) => {
    let d = "<defs>", b = "";
    idx.forEach((i) => {
      const [x, y] = at(ts[i]);
      d += `<radialGradient id="h${i}"><stop stop-color="${cols[i]}" stop-opacity=".75"/><stop offset="1" stop-color="${cols[i]}" stop-opacity="0"/></radialGradient>`;
      b += `<circle cx="${r(x)}" cy="${r(y + 10)}" r="19" fill="url(#h${i})"/>`;
    });
    return d + "</defs>" + b;
  };
  const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>`;
  tiles["garland.svg"] = wrap(base);
  tiles["garland-glow-a.svg"] = wrap(halo([0, 2, 4]));
  tiles["garland-glow-b.svg"] = wrap(halo([1, 3]));
}

// ── 내보내기 ──
const svgFile = (a) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${a.viewBox}">${a.inner.replaceAll("__ID__", "")}</svg>`;

const pi = process.argv.indexOf("--preview");
if (pi > 0) {
  const dir = process.argv[pi + 1];
  if (!dir) throw new Error("--preview 뒤에 폴더를 적는다");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, a] of Object.entries(arts)) fs.writeFileSync(path.join(dir, `${name}.svg`), svgFile(a));
  for (const [f, svg] of Object.entries(tiles)) fs.writeFileSync(path.join(dir, f), svg);
  console.log(Object.entries(arts).map(([n, a]) => `${n} ${(a.inner.length / 1024).toFixed(1)}KB`).join("\n"));
} else {
  const repo = path.resolve(HERE, "../..");
  const SCENE = ["xmas-hills-far", "xmas-hills-mid", "xmas-hills-near", "xmas-ground"];
  const ICON = ["xmas-sparkle", "xmas-snowcap"];
  const raster = ([n, [w, h]]) => `  "${n}": {\n    viewBox: "0 0 ${w} ${h}",\n    attrs: {  },\n    inner: "",\n    src: "/season/christmas/${n}.webp",\n  },\n`;
  const entry = (n, attrs) => `  "${n}": {\n    viewBox: "${arts[n].viewBox}",\n${attrs ? "    attrs: {  },\n" : ""}    inner: ${JSON.stringify(arts[n].inner)},\n  },\n`;
  // 1) 작은 장식 — seasonArtSvgs.ts 의 크리스마스 칸만 갈아 끼운다
  const f1 = path.join(repo, "src/components/season/seasonArtSvgs.ts");
  let t = fs.readFileSync(f1, "utf8");
  const a = t.indexOf("  // ── 크리스마스");
  const b = t.lastIndexOf("};");
  if (a < 0 || b < 0) throw new Error("seasonArtSvgs.ts 에서 크리스마스 칸을 못 찾았다");
  t = t.slice(0, a) + "  // ── 크리스마스 — scripts/season/gen-christmas-art.mjs 가 쓴다. 손으로 고치지 않는다 ──\n" + Object.entries(RASTER).map(raster).join("") + ICON.map((n) => entry(n, true)).join("") + t.slice(b);
  fs.writeFileSync(f1, t);
  // 2) 배경 그림
  const f2 = path.join(repo, "src/components/season/xmasSceneSvgs.ts");
  const head = `/*\n  크리스마스 배경 그림 — scripts/season/gen-christmas-art.mjs 가 만든다. 손으로 고치지 않는다.\n  크리스마스일 때만 받도록 ChristmasBackdrop 만 이 파일을 읽고, 그 컴포넌트는 따로 떼어 불러온다\n  (SeasonBackdrop.tsx). 언덕 · 눈밭뿐이다 — 마을 · 나무 같은 일러스트는 public/season/christmas/xmas-*.webp 다.\n  id 앞의 __ID__ 는 그릴 때 요소마다 다른 값으로 바뀐다(같은 그림을 두 번 그려도 안 겹치게).\n*/\nexport type XmasSceneName =\n${SCENE.map((n) => `  | "${n.replace("xmas-", "")}"`).join("\n")};\n\nexport const XMAS_SCENE_SVGS: Record<XmasSceneName, { viewBox: string; inner: string }> = {\n`;
  fs.writeFileSync(f2, head + SCENE.map((n) => entry(n, false).replace(`"${n}"`, `"${n.replace("xmas-", "")}"`)).join("") + "};\n");
  // 3) CSS 가 url() 로 쓰는 파일
  const pub = path.join(repo, "public/season/christmas");
  for (const [f, svg] of Object.entries(tiles)) fs.writeFileSync(path.join(pub, f), svg);
  console.log("wrote", f1, f2, pub);
}
