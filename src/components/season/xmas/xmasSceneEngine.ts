import type { MascotId } from "@/lib/mascots";
import { PARTS, RIDGE, type HillId, type PartInfo } from "./xmasSceneParts";

/**
 * 크리스마스 장면을 화면에 올린다 — 눈 언덕 세 겹과 그 위의 마을 · 트리 · 가로등, 달과 이스의 썰매, 내리는 눈,
 * 눈덩이 굴리기. 시안(2026-11-27 인계, id 2a5)의 배치 계산을 그대로 옮긴 것이다.
 *
 * 왜 React 가 그리지 않고 여기서 DOM 을 직접 만드나
 *   자리가 전부 "화면 크기 → 그림 1px 이 화면 몇 px 인가(k)" 에서 계산된다(능선에 발 맞추기, 가로등 사이 전구 줄,
 *   트리의 구슬 자리에 걸린 케이프 …). 서버는 화면 크기를 몰라 미리 그릴 수 없고, 눈덩이 · 썰매 · 흔들림은 프레임마다
 *   바뀐다 — 상태로 두면 초당 60번 다시 그린다. 그래서 React 는 빈 칸 셋(하늘은 CSS, 뒤 겹, 앞 겹)만 두고
 *   그 안은 이 파일이 채운다(ChristmasBackdrop.tsx).
 *
 * 좌표계 — 세로 위치 · 크기는 전부 배경 그림 px(2172 × 724)다. 화면이 달라져도 언덕과 요소의 비율이 같다.
 *   k      그림 1px 이 화면 몇 px 인가. 1.25 에서 막는다(그 이상 키우면 그림이 뭉개진다 — 더 넓은 화면은 양옆에
 *          같은 배경을 좌우로 뒤집어 잇는다)
 *   span   요소를 펼치는 폭(화면 px) = min(화면 폭, 화면 높이 × 2)
 *   room   그 폭을 그림 px 로 잰 것. 1870 이상이면 그대로, 그 아래는 요소를 줄이고 need 가 큰 것부터 뺀다,
 *          1250 아래(또는 화면 폭 700 미만)는 좁은 화면 배치(m* 값)
 *
 * 두 가지 모습
 *   home  홈 히어로. 시안 그대로 — 달 · 썰매 · 캐릭터 셋 · 가로등 · 전구 줄. 스크롤하면 가라앉으며 흐려진다.
 *   page  홈 밖. 장면을 낮추고 연하게 누르고, 가운데(본문 뒤)는 비우고 좌우 끝에만 트리 · 집을 둔다.
 *         달은 흐리게 뜨고, 썰매 · 우쥬 · 가로등은 없다. 눈덩이 굴리기는 여기에도 있다(2026-11-27 대표님).
 *
 * 손길에 반응하는 것(home)
 *   우쥬 · 케이프  매달린 채로 달랑달랑 — 잡고 흔들 수 있고, 마우스가 스치면 밀린다. 놓으면 몇 번 흔들리다 잦아든다.
 *   이스의 썰매    잡아서 옮길 수 있다. 놓으면 원래 날던 길을 쫓아가 이어서 난다.
 *   셋 다 끌지 않고 누르기만 하면 그 캐릭터를 커서 캐릭터로 고른다(onSelect).
 *   캐릭터 그림은 콘텐츠 뒤 겹에 있어서 직접 눌리지 않는다 — 앞 겹에 같은 자리의 투명한 손잡이를 둔다.
 *
 * ⚠️ 그림은 <img> 가 아니라 CSS 배경으로 깐다(SeasonArt.tsx 의 카카오톡 인앱 브라우저 건).
 * ⚠️ innerHTML 에 넣는 것은 전부 이 저장소의 고정값(그림 정보 · 계산한 숫자)이다. 사용자 입력이 섞이지 않는다.
 * ⚠️ 여기서 서버를 부르지 않는다. 화면만 움직인다(wye-server-cost).
 */

export type SceneMode = "home" | "page";

type Item = {
  a: string;
  on: HillId;
  x?: number;
  dx?: number;
  h?: number;
  dy?: number;
  fr?: boolean;
  flip?: boolean;
  /** 좁은 화면 값 — 자리 · 옆으로 · 위로 · 높이. nm 이면 좁은 화면에서 뺀다 */
  mx?: number;
  mdx?: number;
  mdy?: number;
  hm?: number;
  nm?: boolean;
  /** room 이 이보다 작으면 뺀다 */
  need?: number;
  id?: string;
  /** 눈길 가장자리에 서는 가로등: -1 왼쪽 · 1 오른쪽, hr 길 반폭 대비 키 */
  edge?: -1 | 1;
  hr?: number;
  /** 두 요소의 정해 둔 자리를 잇는 전구 줄 */
  tie?: [string, [number, number], string, [number, number]];
  /** 다른 요소의 정해 둔 자리에 이 그림의 pin 자리를 맞춘다. mat 은 좁은 화면에서 맞출 자리 */
  at?: [string, [number, number]];
  mat?: [string, [number, number]];
  pin?: [number, number];
  /** 다른 요소 옆에 세운다(그 요소에서 떨어진 거리) */
  rel?: [string, number];
};

const IMG_W = 2172;
const IMG_H = 724;
const RIDGE_STEP = 12;
const K_CAP = 1.25;
const FIT = { full: 1870, min: 1250, lo: 0.66 };
const NARROW_SCALE = 0.7;
/** 배경 세 겹 — top: 그 겹의 그림이 시작하는 자리(그림 px) */
const LAYERS: { id: HillId; top: number; par: number }[] = [
  { id: "far", top: 494, par: 0.25 },
  { id: "mid", top: 550, par: 0.5 },
  { id: "front", top: 656, par: 0.9 },
];
/** 언덕마다 능선 높이에서 잰 길가 눈 더미 줄의 왼쪽 · 오른쪽(그림 px). 가로등이 그 바로 바깥에 선다 */
const PATH_LR: Record<HillId, [number, number]> = { far: [1052, 1125], mid: [1022, 1148], front: [962, 1204] };
const LAMP_K = 1.36;

/** 홈의 배치 — 시안의 ITEMS5 그대로. 순서가 곧 그리는 순서다(뒤의 것이 앞에 온다). */
const HOME_ITEMS: Item[] = [
  { a: "sil1", x: -7, h: 140, on: "far", flip: true },
  { a: "sil1", x: 13, h: 138, on: "far", mx: 8, hm: 133 },
  { a: "sil3", x: 13, dx: 74, h: 96, on: "far", nm: true, need: 1500 },
  { a: "sil2", x: 63, h: 106, on: "far", flip: true, nm: true, need: 1500 },
  { a: "sil1", x: 63, dx: 72, h: 130, on: "far", nm: true },
  { a: "sil2", x: 96, h: 118, on: "far", mx: 94, hm: 113 },
  { a: "sil1", x: 96, dx: 79, h: 144, on: "far", nm: true, need: 1500 },
  { a: "sil3", x: 109, h: 100, on: "far" },
  // 가운데 눈길 양쪽의 가로등과 길을 가로지르는 전구 줄 — 먼 것부터. 서로 다른 언덕끼리는 잇지 않는다
  { a: "lamp", id: "l3", edge: -1, hr: 1.15, on: "far" },
  { a: "lamp", id: "r3", edge: 1, hr: 1.15, on: "far", flip: true },
  { a: "festoon", on: "far", tie: ["l3", [0.5, 0.15], "r3", [0.5, 0.15]] },
  { a: "lamp", id: "l2", edge: -1, hr: 1.3, on: "mid" },
  { a: "lamp", id: "r2", edge: 1, hr: 1.3, on: "mid", flip: true },
  { a: "festoon", on: "mid", tie: ["l2", [0.5, 0.15], "r2", [0.5, 0.15]] },
  // 좁은 화면은 맨 앞 가로등이 양옆 집을 가리고 전구 줄이 SCROLL 글자와 겹친다 — 맨 앞 쌍은 뺀다
  { a: "lamp", id: "l1", edge: -1, hr: 1.28, on: "front", nm: true },
  { a: "lamp", id: "r1", edge: 1, hr: 1.28, on: "front", flip: true, nm: true },
  { a: "festoon", on: "front", tie: ["l1", [0.5, 0.15], "r1", [0.5, 0.15]] },
  // 우쥬 — 맨 앞 왼쪽 가로등의 전구 줄 끝에 걸려 있다(좁은 화면은 가운데 언덕 가로등). 가로등 기준이라 줄에서 떨어지지 않는다
  { a: "woodju", at: ["l1", [1.33, 0.476]], mat: ["l2", [1.75, 0.3]], pin: [0.5, 0.5], h: 98, hm: 92, on: "front", fr: true },
  { a: "snowman", x: 50, dx: 278, rel: ["r1", 113], h: 110, on: "front", fr: true, dy: -10, hm: 94, mdx: 260, mdy: -8 },
  // 왼쪽 무리: 빨간 집, 옆에 전나무, 마당에 울타리, 문 앞에 랜턴
  { a: "tall", x: 25, dx: -138, h: 235, on: "mid", dy: 8, nm: true, need: 1400 },
  { a: "red", x: 25, h: 181, on: "mid", mx: 21, hm: 154 },
  { a: "fence", x: 25, dx: 186, h: 59, on: "mid", nm: true, need: 1780 },
  { a: "lantern", x: 25, dx: 59, h: 48, on: "mid", fr: true, dy: -7, nm: true, need: 1500 },
  // 오른쪽 무리: 예배당과 초록 집, 사이에 전나무, 집 옆에 울타리
  { a: "small", x: 75, dx: 3, h: 151, on: "mid", dy: 16, mx: 82, mdx: 88, hm: 129, mdy: 12 },
  { a: "fence", x: 75, dx: -240, h: 59, on: "mid", nm: true, need: 1780 },
  { a: "chapel", x: 75, dx: -94, h: 267, on: "mid", mx: 82, mdx: 0, hm: 228 },
  { a: "green", x: 75, dx: 103, h: 178, on: "mid", nm: true },
  // 앞 눈밭 왼쪽: 구슬 트리와 선물. 케이프는 그림에서 지운 남색 구슬 자리에 같은 크기로 걸려 있다
  { a: "star", id: "star", x: 7.5, h: 400, on: "front", mx: 3, hm: 360 },
  { a: "kape", at: ["star", [0.6875, 0.4186]], pin: [0.476, 0.14], h: 66, hm: 76, on: "front" },
  { a: "pblue", x: 7.5, dx: 136, h: 54, on: "front", fr: true, dy: -6, nm: true, need: 1500 },
  { a: "pred", x: 7.5, dx: 190, h: 60, on: "front", fr: true, dy: -10, nm: true, need: 1500 },
];

/**
 * 홈 밖의 배치 — 본문이 지나가는 가운데는 비우고 좌우 끝에만 둔다(2026-11-27 대표님: "가장자리만 + 연하게").
 * 가로등 · 전구 줄 · 우쥬 · 눈사람 · 선물은 없다. 케이프는 트리의 빈 구슬 자리를 메우려고 남긴다(눌리지는 않는다).
 */
const PAGE_ITEMS: Item[] = [
  { a: "sil1", x: -7, h: 140, on: "far", flip: true },
  { a: "sil1", x: 6, h: 138, on: "far", mx: 4, hm: 133 },
  { a: "sil3", x: 6, dx: 74, h: 96, on: "far", nm: true, need: 1500 },
  { a: "sil2", x: 94, h: 118, on: "far", mx: 95, hm: 113 },
  { a: "sil1", x: 94, dx: 79, h: 144, on: "far", nm: true, need: 1500 },
  { a: "sil3", x: 107, h: 100, on: "far" },
  { a: "tall", x: 8, dx: -138, h: 235, on: "mid", dy: 8, nm: true, need: 1400 },
  { a: "red", x: 8, h: 181, on: "mid", mx: 16, hm: 154 },
  { a: "small", x: 92, dx: 3, h: 151, on: "mid", dy: 16, mx: 96, mdx: 60, hm: 129, mdy: 12 },
  { a: "chapel", x: 92, dx: -94, h: 267, on: "mid", mx: 92, mdx: 0, hm: 228 },
  { a: "green", x: 92, dx: 103, h: 178, on: "mid", nm: true },
  { a: "star", id: "star", x: 1.5, h: 400, on: "front", mx: -3, hm: 360 },
  { a: "kape", at: ["star", [0.6875, 0.4186]], pin: [0.476, 0.14], h: 66, hm: 76, on: "front" },
];

/** 장면이 화면 높이에서 차지하는 몫(%) — [넓은 화면, 좁은 화면] */
const SCENE_HEIGHT: Record<SceneMode, [number, number]> = { home: [62, 58], page: [44, 38] };

/** 눈덩이 굴리기 — 값의 뜻은 buildPlay 에. m 은 좁은 화면(과 홈 밖) 값 */
const PLAY = {
  idle: { wait: 1.8, go: 2.4, amp: 1.5, after: [30, 60] as [number, number] },
  baby: { n: 3, w: 413, h: 595, body: 0.565 },
  from: 61,
  fromRel: ["r1", 190] as [string, number],
  to: 97,
  home: 0.62,
  init: [0.28],
  h: 90,
  dy: 9,
  start: 0.6,
  len: 0.7,
  push: 0.34,
  max: 6,
  m: { from: 8, to: 92, home: 0.74, init: [] as number[], h: 96, len: 1.1, push: 0.3, max: 3 },
};

const MOON = { x: 79, y: 19, d: 13 };
/** 썰매 — size 폭(s 단위), dur 화면을 한 번 지나는 시간(초), cy 그림 위에서 길에 맞추는 자리, mk 좁은 화면 배율 */
const SLEIGH = { size: 27, dur: 16, slope: 5, arc: 3, cy: 0.165, mk: 1.25, ratio: 705 / 2165 };

const SNOW = { n: 80, size: [1, 2.8], speed: 0.55, wind: 0.1 };

const src = (name: string) => `/season/christmas/scene/${name}.${PARTS[name]?.png ? "png" : "webp"}`;
const file = (name: string) => `/season/christmas/scene/${name}.webp`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function el(cls: string, html?: string): HTMLDivElement {
  const e = document.createElement("div");
  e.className = cls;
  // 잡거나 끌 수 있는 것(눈덩이 · 캐릭터 손잡이) — 커서 마스코트가 이 표식을 보고 흐려지고, 잡으면 커진다(MascotCursor.tsx)
  if (/\bxmas-sc-(ball|hit)\b/.test(cls)) e.dataset.grab = "";
  if (html) e.innerHTML = html;
  return e;
}

/** 그림 한 장을 칸에 꽉 채운다(CSS 배경). */
const picStyle = (url: string) => `background:url(${url}) center/100% 100% no-repeat;`;

const hexMix = (a: string, t: number) => {
  // a 를 흰색 쪽으로 t 만큼
  const c = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  return "#" + c.map((x) => Math.round(x + (255 - x) * t).toString(16).padStart(2, "0")).join("");
};

/**
 * 눈덩이 · 아기 눈사람의 상태. 화면 크기가 바뀌어 다시 그려도, 다른 페이지로 넘어가도 남는다(새로 고치면 처음으로).
 * 자리는 굴릴 수 있는 구간 안의 비율(u)로 기억한다.
 */
const game = {
  babies: null as { u: number; st: number; flip: number; el?: HTMLElement }[] | null,
  ball: { u: 0.5, g: 0, rot: 0 },
  vx: 0,
  used: false,
  quiet: 0,
  timer: 0,
};

/** 매달린 캐릭터의 흔들림 — 매달린 점을 중심으로 한 각도 하나로 다룬다. */
type Swing = {
  id: MascotId;
  /** 돌리는 요소(그림) */
  inner: HTMLElement;
  /** 앞 겹의 투명한 손잡이 */
  hit: HTMLElement;
  /** 매달린 점 — 그림 안에서의 비율 */
  org: [number, number];
  ang: number;
  vel: number;
  /** 가만히 있을 때의 잔잔한 흔들림: 각도(°) · 한 번 왕복하는 시간(초) */
  idleAmp: number;
  idlePeriod: number;
  max: number;
  grab: boolean;
  pivot: [number, number];
};

export function mountXmasScene(
  back: HTMLElement,
  front: HTMLElement,
  opts: { mode: SceneMode; reduceMotion: boolean; onSelect: (id: MascotId) => void },
): () => void {
  const { mode, reduceMotion: reduce } = opts;
  const home = mode === "home";

  let raf = 0;
  let last = 0;
  let t0 = performance.now();
  let built = false;
  let layers: { el: HTMLElement; par: number }[] = [];
  let playStep: ((dt: number) => void) | null = null;
  let snow: { cv: HTMLCanvasElement; list: { x: number; y: number; r: number; z: number; vy: number; ph: number; a: number }[]; W: number; H: number } | null = null;
  let swings: Swing[] = [];
  let sleighEl: HTMLElement | null = null;
  let sleighHit: HTMLElement | null = null;
  const sleigh = { ox: 0, oy: 0, grab: false, gx: 0, gy: 0, px: 0, py: 0, x: 0, y: 0, moved: 0, pid: -1 };
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let off = false; // 히어로를 지났다 — 앞 겹의 손잡이 · 눈덩이를 끈다
  const cleanups: (() => void)[] = [];

  function build() {
    cancelAnimationFrame(raf);
    cleanups.splice(0).forEach((fn) => fn());
    back.textContent = "";
    front.textContent = "";
    layers = [];
    swings = [];
    playStep = null;
    sleighEl = sleighHit = null;
    sleigh.grab = false;
    sleigh.ox = sleigh.oy = 0;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const mobile = W < 700;
    const [dh, mh] = SCENE_HEIGHT[mode];
    const kOf = (ph: number) => Math.min(K_CAP, Math.max(W / IMG_W, (H * ph) / 100 / IMG_H));
    const span = Math.min(W, H * 2);
    const narrow = mobile || span / kOf(dh) < FIT.min;
    const k = kOf(narrow ? mh : dh);
    const room = span / k;
    const iw = IMG_W * k;
    const gap = Math.max(0, (W - iw) / 2);
    const left = gap ? gap : Math.min(0, Math.max(W - iw, W / 2 - 0.5 * iw));
    const sc = narrow ? NARROW_SCALE : clamp(room / FIT.full, FIT.lo, 1);
    const items = home ? HOME_ITEMS : PAGE_ITEMS;

    // 그림 좌표 x 에서 그 언덕 능선의 y. 그림 밖은 거울처럼 뒤집어 이은 자리다
    const ridge = (id: HillId, x: number) => {
      let t = ((x % (2 * IMG_W)) + 2 * IMG_W) % (2 * IMG_W);
      if (t > IMG_W) t = 2 * IMG_W - t;
      const R = RIDGE[id];
      const f = t / RIDGE_STEP;
      const i = Math.min(R.length - 2, Math.floor(f));
      return R[i] + (R[i + 1] - R[i]) * (f - i);
    };
    type Geo = { x: number; base: number; w: number; h: number; flip?: boolean };
    const geo: Record<string, Geo> = {};
    const at = (g: Geo, [nx, ny]: [number, number]): [number, number] => [g.x - g.w / 2 + (g.flip ? 1 - nx : nx) * g.w, g.base - g.h + ny * g.h];
    let uid = 0;

    /* ── 하늘 쪽: 달 · 썰매(홈에서만) ── */
    const skyArt = el("xmas-sc-skyart");
    back.appendChild(skyArt);
    const s = Math.min(H / 100, (W * 1.3) / 100);
    {
      // 달 — 홈 밖에서는 흐리게(season.css), 본문을 피해 오른쪽 끝으로 조금 더 민다(2026-11-27 대표님). 썰매는 홈에서만
      const moonL = el("xmas-sc-layer");
      skyArt.appendChild(moonL);
      layers.push({ el: moonL, par: 0.12 });
      const md = (mobile ? MOON.d * 0.9 : MOON.d) * s;
      const moon = el("xmas-sc-pt xmas-sc-moon");
      moon.style.cssText = `left:${home ? MOON.x : 88}%;top:${(MOON.y * s).toFixed(1)}px;width:${md.toFixed(1)}px;height:${md.toFixed(1)}px;transform:translate(-50%,-50%);${picStyle(file("moon"))}`;
      moonL.appendChild(moon);
    }
    if (home) {
      const sleighL = el("xmas-sc-layer");
      skyArt.appendChild(sleighL);
      layers.push({ el: sleighL, par: 0.16 });
      sleighEl = el("xmas-sc-sleigh");
      sleighEl.style.cssText = picStyle(file("sleigh"));
      sleighL.appendChild(sleighEl);
    }

    /* ── 땅 쪽: 언덕 겹과 그 사이사이의 요소 ── */
    const ground = el("xmas-sc-ground xmas-sc-floor");
    back.appendChild(ground);

    // 요소 위에 얹는 것: 전구 빛 · 등불 빛 · 굴뚝 연기
    const overlay = (P: PartInfo, w: number, h: number) => {
      let over = "";
      if (P.glow) {
        // 전구마다 옅은 빛을 얹고 세 무리로 번갈아 깜빡인다
        const g = ["", "", ""];
        P.glow.forEach(([nx, ny, nr, c], i) => {
          const r = nr * h;
          g[i % 3] += `<circle cx="${(nx * w).toFixed(1)}" cy="${(ny * h).toFixed(1)}" r="${(r * 1.5 + 3).toFixed(1)}" fill="${c}" opacity=".26"/><circle cx="${(nx * w).toFixed(1)}" cy="${(ny * h).toFixed(1)}" r="${(r * 0.5).toFixed(1)}" fill="${hexMix(c, 0.6)}" opacity=".55"/>`;
        });
        over += g.map((part, i) => `<g class="xmas-sc-glow" style="animation-delay:${-i * 1.1}s">${part}</g>`).join("");
      }
      if (P.lampGlow) {
        const [nx, ny, nr] = P.lampGlow;
        const gid = `xmas-sc-g${uid++}`;
        over += `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs><circle class="xmas-sc-bulb" cx="${(nx * w).toFixed(1)}" cy="${(ny * h).toFixed(1)}" r="${(nr * h).toFixed(1)}" fill="url(#${gid})"/>`;
      }
      if (P.smoke) over += `<g class="xmas-sc-smoke" transform="translate(${(P.smoke[0] * w).toFixed(1)} ${(P.smoke[1] * h).toFixed(1)}) scale(${(h / 115).toFixed(2)})"><circle r="8"/><circle r="8"/><circle r="8"/></g>`;
      return over ? `<svg viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" aria-hidden="true">${over}</svg>` : "";
    };

    // 캐릭터 자리 — 앞 겹에 손잡이를 놓으려고 적어 둔다
    const charBoxes: { a: string; x0: number; y0: number; w: number; h: number; inner: HTMLElement }[] = [];

    const mount = (layer: HTMLElement, a: string, x0: number, y0: number, w: number, h: number, extra = "") => {
      const P = PARTS[a];
      const e = el("xmas-sc-pt");
      e.style.cssText = `left:${(x0 * k).toFixed(1)}px;top:${(y0 * k).toFixed(1)}px;width:${(w * k).toFixed(1)}px;height:${(h * k).toFixed(1)}px;${extra}`;
      if (P.ch) {
        // 캐릭터: 사이트와 같은 색 후광. 우쥬는 떠다니는 겹(.xmas-sc-float)을 한 겹 더 둔다 — 그 안의 그림만 손길에 돌아간다
        const inner = el("xmas-sc-char");
        inner.style.cssText = `${picStyle(src(a))}filter:drop-shadow(0 0 ${Math.round(h * k * 0.3)}px ${P.glowC});`;
        if (a === "woodju") {
          const floater = el("xmas-sc-float");
          floater.appendChild(inner);
          e.appendChild(floater);
        } else e.appendChild(inner);
        charBoxes.push({ a, x0, y0, w, h, inner });
      } else {
        e.style.cssText += picStyle(src(a));
        const over = overlay(P, w, h);
        if (over) e.innerHTML = over;
      }
      layer.appendChild(e);
    };

    const put = (layer: HTMLElement, it: Item) => {
      if (narrow ? it.nm : it.need && room < it.need) return;
      const P = PARTS[it.a];
      if (it.tie) {
        // 두 요소의 정해 둔 자리를 잇는다 — 화면이 달라져 두 요소의 높이가 어긋나도 줄 끝이 따라간다
        const [ia, pa, ib, pb] = it.tie;
        if (!geo[ia] || !geo[ib] || !P.ends) return;
        const [ax, ay] = at(geo[ia], pa);
        const [bx, by] = at(geo[ib], pb);
        const [e0, e1] = P.ends;
        const w = Math.hypot(bx - ax, by - ay) / (e1[0] - e0[0]);
        const h = (w * P.h) / P.w;
        mount(layer, it.a, ax - e0[0] * w, ay - e0[1] * h, w, h, `transform-origin:${(e0[0] * 100).toFixed(2)}% ${(e0[1] * 100).toFixed(2)}%;transform:rotate(${((Math.atan2(by - ay, bx - ax) * 180) / Math.PI).toFixed(2)}deg);`);
        return;
      }
      let h = (narrow && it.hm ? it.hm : (it.h ?? 0)) * sc;
      let x = 0;
      let base = 0;
      if (it.edge) {
        // 눈길 가장자리에 세운다. 길은 그림이라 줄지 않는다 — 자리는 그대로 두고 가로등 키만 절반쯤 따라 줄인다
        const [xl, xr] = PATH_LR[it.on];
        const hw = (xr - xl) / 2;
        x = (xl + xr) / 2 + it.edge * hw * LAMP_K;
        h = hw * LAMP_K * (it.hr ?? 1) * (narrow ? 0.9 : 0.45 + 0.55 * sc);
      }
      const w = (h * P.w) / P.h;
      const atv = narrow && it.mat ? it.mat : it.at;
      if (atv) {
        if (!geo[atv[0]]) return;
        const [px, py] = at(geo[atv[0]], atv[1]);
        const pin = it.pin ?? [0.5, 0];
        x = px - (pin[0] - 0.5) * w;
        base = py - pin[1] * h + h;
      } else {
        if (!it.edge) {
          const ax = narrow && it.mx != null ? it.mx : (it.x ?? 50);
          x = (W / 2 + ((ax - 50) / 100) * span - left) / k + (narrow && it.mdx != null ? it.mdx : (it.dx ?? 0)) * sc;
          if (it.rel && geo[it.rel[0]]) x = geo[it.rel[0]].x + it.rel[1] * sc;
        }
        // 요소 폭 안에서 능선이 가장 낮은 곳에 발을 맞춘다(비탈에서 한쪽이 뜨지 않게). 능선 뒤에 서는 것은 3% 묻는다
        for (const t of [-0.36, -0.18, 0, 0.18, 0.36]) base = Math.max(base, ridge(it.on, x + t * w));
        base += (it.fr ? 0 : h * 0.03) - (narrow && it.mdy != null ? it.mdy : (it.dy ?? 0)) * sc;
      }
      if (it.id) geo[it.id] = { x, base, w, h, flip: it.flip };
      mount(layer, it.a, x - w / 2, base - h, w, h, it.flip ? "transform:scaleX(-1);" : "");
    };

    // inset:auto — .xmas-sc-layer 의 inset:0 을 풀어야 아래에 붙는다(안 풀면 위에 붙어 판 전체가 위로 올라간다)
    const layerBox = `inset:auto;left:${left.toFixed(1)}px;bottom:-6px;width:${iw.toFixed(1)}px;height:${(IMG_H * k).toFixed(1)}px`;
    for (const L of LAYERS) {
      // 겹마다 같은 크기의 판(배경 그림 전체 크기)을 바닥에 붙이고, 그 안에서 그림 좌표로 놓는다
      const layer = el(`xmas-sc-layer xmas-sc-hill--${L.id}`);
      layer.style.cssText = layerBox;
      ground.appendChild(layer);
      layers.push({ el: layer, par: L.par });
      const mine = items.filter((it) => it.on === L.id);
      mine.filter((it) => !it.fr).forEach((it) => put(layer, it));
      // 화면이 그림보다 넓으면 좌우를 뒤집은 같은 그림으로 잇는다(시차로 움직일 때 가장자리가 비지 않게 늘 붙여 둔다)
      const st = `position:absolute;top:${(L.top * k).toFixed(1)}px;height:${((IMG_H - L.top) * k).toFixed(1)}px;width:100%;${picStyle(file(`bg-${L.id}`))}`;
      for (const p of ["right:calc(100% - 1px);transform:scaleX(-1)", "left:calc(100% - 1px);transform:scaleX(-1)", "left:0"]) {
        const bg = el("xmas-sc-bg");
        bg.style.cssText = `${st}${p}`;
        layer.appendChild(bg);
      }
      mine.filter((it) => it.fr).forEach((it) => put(layer, it));
    }

    // 히어로를 지나면 배경을 눌러 뒤 장면(행성 · 인스타 · 공지)의 글자를 살린다
    if (home) back.appendChild(el("xmas-sc-dim"));

    /* ── 눈 ── */
    if (!reduce) {
      const cv = document.createElement("canvas");
      cv.className = "xmas-sc-snow";
      back.appendChild(cv);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.getContext("2d")?.scale(dpr, dpr);
      const n = Math.round(SNOW.n * (mobile ? 0.55 : 1) * (home ? 1 : 0.6));
      snow = {
        cv,
        W,
        H,
        list: Array.from({ length: n }, () => {
          const z = Math.random();
          return { x: Math.random() * W, y: Math.random() * H, r: SNOW.size[0] + z * (SNOW.size[1] - SNOW.size[0]), z, vy: (0.35 + z * 0.75) * SNOW.speed * 60, ph: Math.random() * 6.28, a: 0.35 + z * 0.55 };
        }),
      };
    } else snow = null;

    /* ── 앞 겹: 눈덩이 굴리기와 캐릭터 손잡이 ── */
    const playGround = el("xmas-sc-ground xmas-sc-floor");
    const playLayer = el("xmas-sc-layer");
    playLayer.style.cssText = layerBox;
    playGround.appendChild(playLayer);
    front.appendChild(playGround);
    layers.push({ el: playLayer, par: 0.9 });
    buildPlay(playLayer, { k, left, W, span, narrow, sc, ridge, geo });

    if (home) {
      for (const c of charBoxes) {
        const id = c.a as MascotId;
        const hit = el("xmas-sc-hit");
        const pad = 10 / k;
        hit.style.cssText = `left:${((c.x0 - pad) * k).toFixed(1)}px;top:${((c.y0 - pad) * k).toFixed(1)}px;width:${((c.w + 2 * pad) * k).toFixed(1)}px;height:${((c.h + 2 * pad) * k).toFixed(1)}px;`;
        playLayer.appendChild(hit);
        const kape = c.a === "kape";
        const org: [number, number] = kape ? [0.476, 0.14] : [0.5, 0.06];
        c.inner.style.transformOrigin = `${org[0] * 100}% ${org[1] * 100}%`;
        const sw: Swing = { id, inner: c.inner, hit, org, ang: 0, vel: 0, idleAmp: kape ? 7 : 2.5, idlePeriod: kape ? 6.4 : 5, max: kape ? 35 : 20, grab: false, pivot: [0, 0] };
        swings.push(sw);
        bindSwing(sw);
      }
      if (sleighEl) {
        sleighHit = el("xmas-sc-hit xmas-sc-hit--sleigh");
        front.appendChild(sleighHit);
        bindSleigh(sleighHit);
      }
    } else {
      // 홈 밖의 케이프는 눌리지 않는 장식이다 — 고리를 중심으로 잔잔히 흔들리기만 한다
      for (const c of charBoxes) {
        c.inner.style.transformOrigin = "47.6% 14%";
        c.inner.classList.add("xmas-sc-swing");
      }
    }

    onScroll();
    if (!built) t0 = performance.now();
    built = true;
    last = performance.now();
    // 썰매는 여기서 한 번 놓는다 — 가려진 탭에서 열리면 frame 이 아무것도 안 그려서, 돌아왔을 때 크기 없는 썰매가 남는다
    sleighAt(last, 0);
    frame(last);
  }

  /* ── 눈덩이 굴리기 ──
     맨 앞 눈밭의 눈덩이를 누르면 밀리고, 끌면 따라 구른다. 구른 만큼 커지다가 아기 눈사람 몸통만큼 되면 그 자리에서
     아기 눈사람(세 가지 중 하나)이 되고, 빈 자리에 새 눈덩이가 생긴다. 가만히 두면 눈덩이가 혼자 좌우로 조금 굴렀다
     돌아온다(눈에 띄게 하려는 것 — 이때는 커지지 않는다). 사람이 한 번 만지면 30~60초 쉬었다가 다시 혼자 구른다. */
  function buildPlay(
    layer: HTMLElement,
    g: { k: number; left: number; W: number; span: number; narrow: boolean; sc: number; ridge: (id: HillId, x: number) => number; geo: Record<string, { x: number }> },
  ) {
    const { k, left, W, span, narrow, sc, ridge, geo } = g;
    // 홈 밖은 **왼쪽 귀퉁이**에서만 논다 — 본문 위로 굴러오면 글을 읽는 데 거슬리고, 오른쪽 아래에는 카카오톡 · 인스타
    // 버튼이 떠 있다(2026-11-27 대표님). 구간은 화면 왼쪽 끝에서 본문 틀(max-w-5xl, 1024px)이 시작하기 전까지다.
    // 본문이 화면 폭을 다 쓰는 좁은 화면에서는 왼쪽 22% 까지만 준다.
    // 구간이 짧아서 아기 눈사람은 둘까지만 두고, 왔다 갔다 굴려야 다 크게 len 을 늘렸다.
    const pageTo = Math.max(narrow ? 22 : 9, (((W - 1024) / 2 - 12) / W) * 100);
    const R = !home
      ? { ...PLAY, ...PLAY.m, from: 1, to: pageTo, home: 0.55, len: 1.8, push: 0.45, max: 2 }
      : narrow
        ? { ...PLAY, ...PLAY.m }
        : PLAY;
    window.clearTimeout(game.timer);
    const X = (pct: number) => (W / 2 + ((pct - 50) / 100) * (home ? span : W) - left) / k; // 화면 % → 그림 px
    // 구간의 왼쪽 끝: 홈의 넓은 화면은 오른쪽 맨 앞 가로등 옆에서 시작한다(눈사람 · 가로등과 겹치지 않게)
    const rel = !narrow && home ? geo[PLAY.fromRel[0]] : undefined;
    const x0 = rel ? rel.x + PLAY.fromRel[1] * sc : X(R.from);
    const x1 = Math.max(x0 + 120, X(R.to));
    const span1 = x1 - x0;
    const bh = R.h * sc;
    const bw = (bh * PLAY.baby.w) / PLAY.baby.h;
    const body = bh * PLAY.baby.body; // 아기 눈사람 몸통 지름(그림 px)
    const d0 = body * PLAY.start; // 눈덩이 처음 지름
    const L = span1 * R.len; // 다 크기까지 굴려야 하는 거리
    const baseAt = (x: number) => ridge("front", x) + PLAY.dy * sc;
    // 아직 손대지 않았으면 화면이 바뀔 때마다 그 화면의 처음 모습으로 다시 놓는다(좁은 화면과 넓은 화면의 처음 모습이 다르다)
    if (!game.babies || !game.used) {
      game.babies = R.init.map((u, i) => ({ u, st: i % PLAY.baby.n, flip: i % 2 }));
      game.ball = { u: R.home, g: 0, rot: 0 };
    }
    game.vx = 0;
    const babies = game.babies;
    const ballEl = el("xmas-sc-ball", `<div style="${picStyle(file("ball"))}"></div>`);
    const ballPic = ballEl.firstChild as HTMLElement;
    layer.appendChild(ballEl);
    const addBaby = (q: { u: number; st: number; flip: number; el?: HTMLElement }, pop: boolean) => {
      const x = x0 + span1 * q.u;
      const base = baseAt(x);
      const e = el(`xmas-sc-baby${pop ? " xmas-sc-pop" : ""}`, `<div style="${picStyle(file(`baby${q.st + 1}`))}${q.flip ? "transform:scaleX(-1);" : ""}"></div>`);
      e.style.cssText = `left:${((x - bw / 2) * k).toFixed(1)}px;top:${((base - bh) * k).toFixed(1)}px;width:${(bw * k).toFixed(1)}px;height:${(bh * k).toFixed(1)}px`;
      layer.insertBefore(e, ballEl);
      q.el = e;
    };
    while (babies.length > R.max) babies.shift();
    babies.forEach((q) => addBaby(q, false));
    // idle: 가만히 둔 시간(초), sway: 혼자 구를 때 제자리에서 벗어난 거리(그림 px) — 자리(u)와 크기(g)는 건드리지 않는다
    let idle = 0;
    let sway = 0;
    const hush = () => {
      const [a, b] = PLAY.idle.after;
      game.quiet = performance.now() + (a + Math.random() * (b - a)) * 1000;
    };
    const diameter = () => d0 + (body - d0) * game.ball.g;
    const drawBall = () => {
      const b = game.ball;
      const d = diameter();
      const x = clamp(x0 + span1 * b.u + sway, x0, x1);
      ballEl.style.width = ballEl.style.height = `${(d * k).toFixed(1)}px`;
      ballEl.style.transform = `translate(${((x - d / 2) * k).toFixed(1)}px, ${((baseAt(x) - d) * k).toFixed(1)}px)`;
      ballPic.style.transform = `rotate(${(b.rot + (sway / (Math.PI * d)) * 360).toFixed(1)}deg)`;
    };
    let pid: number | null = null;
    let lastX = 0;
    let lastT = 0;
    let moved = 0;
    const make = () => {
      const b = game.ball;
      if (pid != null) {
        try {
          ballEl.releasePointerCapture(pid);
        } catch {
          /* 이미 놓였다 */
        }
        pid = null;
      }
      game.vx = 0;
      idle = sway = 0;
      ballEl.classList.remove("xmas-sc-grab");
      const q = { u: b.u, st: Math.floor(Math.random() * PLAY.baby.n), flip: Math.random() < 0.5 ? 1 : 0 } as { u: number; st: number; flip: number; el?: HTMLElement };
      babies.push(q);
      addBaby(q, true);
      while (babies.length > R.max) {
        const old = babies.shift()?.el; // 너무 많아지면 가장 먼저 만든 것부터 녹는다
        if (old) {
          old.classList.add("xmas-sc-melt");
          window.setTimeout(() => old.remove(), 1500);
        }
      }
      ballEl.style.display = "none";
      // 새 눈덩이는 아기 눈사람들에게서 가장 먼 자리에 생긴다
      let best = R.home;
      let far = -1;
      for (let u = 0.06; u <= 0.95; u += 0.08) {
        const near = Math.min(...babies.map((p) => Math.abs(p.u - u)));
        if (near > far) {
          far = near;
          best = u;
        }
      }
      game.ball = { u: best, g: 0, rot: 0 };
      game.timer = window.setTimeout(() => {
        ballEl.style.display = "";
        ballEl.classList.add("xmas-sc-in");
        drawBall();
      }, 700);
    };
    // 그림 px 만큼 굴린다. 구간 끝에 닿으면 true
    const roll = (dx: number) => {
      const b = game.ball;
      const from = x0 + span1 * b.u;
      const to = clamp(from + dx, x0, x1);
      b.rot += ((to - from) / (Math.PI * diameter())) * 360;
      b.g = Math.min(1, b.g + Math.abs(to - from) / L);
      b.u = (to - x0) / span1;
      drawBall();
      if (b.g >= 1) make();
      return to !== from + dx;
    };
    ballEl.addEventListener("pointerdown", (e) => {
      pid = e.pointerId;
      try {
        ballEl.setPointerCapture(pid);
      } catch {
        /* 잡지 못해도 굴릴 수는 있다 */
      }
      lastX = e.clientX;
      lastT = e.timeStamp;
      moved = 0;
      game.vx = 0;
      // 혼자 구르던 중에 잡았으면 지금 보이는 자리에서 이어 굴린다
      game.ball.u = clamp(game.ball.u + sway / span1, 0, 1);
      game.ball.rot += (sway / (Math.PI * diameter())) * 360;
      idle = sway = 0;
      game.used = true;
      hush();
      ballEl.classList.remove("xmas-sc-in");
      ballEl.classList.add("xmas-sc-grab");
      e.preventDefault();
    });
    ballEl.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      const dpx = e.clientX - lastX;
      const dt = Math.max(1, e.timeStamp - lastT);
      moved += Math.abs(dpx);
      lastX = e.clientX;
      lastT = e.timeStamp;
      game.vx = game.vx * 0.5 + (dpx / k / dt) * 500; // 손을 뗄 때 이어 구를 속도(그림 px/초)
      roll(dpx / k);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = null;
      ballEl.classList.remove("xmas-sc-grab");
      if (moved < 6) {
        // 끌지 않고 누르기만 했다: 누른 쪽의 반대로 민다. 한가운데를 눌렀으면 자리가 넓은 쪽으로
        const r = ballEl.getBoundingClientRect();
        const offX = e.clientX - (r.left + r.width / 2);
        game.vx = (Math.abs(offX) > r.width * 0.12 ? -Math.sign(offX) : game.ball.u < 0.5 ? 1 : -1) * R.push * span1;
      } else if (e.timeStamp - lastT > 120) game.vx = 0;
      else game.vx = clamp(game.vx, -1600, 1600);
      hush();
    };
    ballEl.addEventListener("pointerup", up);
    ballEl.addEventListener("pointercancel", up);
    playStep = (dt) => {
      if (pid != null) return;
      if (game.vx) {
        const hit = roll(game.vx * dt);
        game.vx *= hit ? -0.45 : Math.pow(0.12, dt); // 끝에 닿으면 튕겨 나오고, 아니면 눈에 묻혀 서서히 선다
        if (Math.abs(game.vx) < 6) game.vx = 0;
        idle = 0;
        return;
      }
      if (reduce) return;
      if (performance.now() < game.quiet) {
        idle = 0;
        return;
      }
      // 혼자 구르기: wait 초 쉬고 go 초 동안 한쪽으로 굴렀다가 반대쪽을 거쳐 제자리로 돌아온다
      idle += dt;
      const I = PLAY.idle;
      const p = ((idle - I.wait) % (I.wait + I.go)) / I.go;
      const next = idle < I.wait || p < 0 || p > 1 ? 0 : diameter() * I.amp * Math.sin(2 * Math.PI * p) * Math.sin(Math.PI * p);
      if (next !== sway) {
        sway = next;
        drawBall();
      }
    };
    drawBall();
  }

  /* ── 우쥬 · 케이프: 달랑달랑 ── */
  function bindSwing(sw: Swing) {
    let pid = -1;
    let moved = 0;
    let sx = 0;
    let sy = 0;
    const angleTo = (e: PointerEvent) => clamp((-Math.atan2(e.clientX - sw.pivot[0], Math.max(8, e.clientY - sw.pivot[1])) * 180) / Math.PI, -sw.max, sw.max);
    sw.hit.addEventListener("pointerdown", (e) => {
      pid = e.pointerId;
      moved = 0;
      sx = e.clientX;
      sy = e.clientY;
      if (!reduce) {
        try {
          sw.hit.setPointerCapture(pid);
        } catch {
          /* 잡지 못해도 누르기는 된다 */
        }
        // 매달린 점의 화면 자리 — 손잡이는 그림보다 사방 10px 넓다
        const r = sw.hit.getBoundingClientRect();
        sw.pivot = [r.left + 10 + (r.width - 20) * sw.org[0], r.top + 10 + (r.height - 20) * sw.org[1]];
        sw.grab = true;
      }
      e.preventDefault();
    });
    sw.hit.addEventListener("pointermove", (e) => {
      if (reduce) return;
      if (e.pointerId === pid && sw.grab) {
        moved += Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
        sx = e.clientX;
        sy = e.clientY;
        const next = angleTo(e);
        sw.vel = (next - sw.ang) * 30;
        sw.ang = next;
      } else if (e.pointerType === "mouse" && pid < 0) {
        // 잡지 않고 스치기만 해도 살짝 밀린다
        sw.vel = clamp(sw.vel - e.movementX * 2.2, -260, 260);
      }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1;
      sw.grab = false;
      sw.vel = clamp(sw.vel, -260, 260);
      // 끌거나 흔들지 않고 누르기만 했다 — 이 캐릭터를 커서 캐릭터로 고른다
      if (moved < 6 && e.type === "pointerup") opts.onSelect(sw.id);
    };
    sw.hit.addEventListener("pointerup", up);
    sw.hit.addEventListener("pointercancel", up);
  }

  function stepSwings(dt: number, t: number) {
    for (const sw of swings) {
      if (!sw.grab) {
        // 잔잔한 흔들림을 쫓아가는 용수철 — 놓으면 몇 번 흔들리다 그 움직임으로 잦아든다
        const target = sw.idleAmp * Math.sin(((t - t0) / 1000 / sw.idlePeriod) * 2 * Math.PI);
        sw.vel += (-42 * (sw.ang - target) - 2.4 * sw.vel) * dt;
        sw.ang = clamp(sw.ang + sw.vel * dt, -sw.max * 1.2, sw.max * 1.2);
      }
      sw.inner.style.transform = `rotate(${sw.ang.toFixed(2)}deg)`;
    }
  }

  /* ── 이스의 썰매: 달을 지나는 완만한 호를 따라 오른쪽에서 왼쪽으로(그림이 왼쪽을 본다) ── */
  function bindSleigh(hit: HTMLElement) {
    hit.addEventListener("pointerdown", (e) => {
      sleigh.pid = e.pointerId;
      sleigh.moved = 0;
      sleigh.px = e.clientX;
      sleigh.py = e.clientY;
      if (!reduce) {
        try {
          hit.setPointerCapture(e.pointerId);
        } catch {
          /* 잡지 못해도 누르기는 된다 */
        }
        sleigh.grab = true;
        // 잡은 자리와 썰매 사이의 거리 — 끄는 동안 그대로 지킨다
        sleigh.gx = e.clientX - (sleigh.x + sleigh.ox);
        sleigh.gy = e.clientY - (sleigh.y + sleigh.oy);
      }
      e.preventDefault();
    });
    hit.addEventListener("pointermove", (e) => {
      if (e.pointerId !== sleigh.pid || !sleigh.grab) return;
      sleigh.moved += Math.abs(e.clientX - sleigh.px) + Math.abs(e.clientY - sleigh.py);
      sleigh.px = e.clientX;
      sleigh.py = e.clientY;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== sleigh.pid) return;
      sleigh.pid = -1;
      sleigh.grab = false;
      if (sleigh.moved < 6 && e.type === "pointerup") opts.onSelect("is");
    };
    hit.addEventListener("pointerup", up);
    hit.addEventListener("pointercancel", up);
  }

  function sleighAt(t: number, dt: number) {
    if (!sleighEl) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = Math.min(H / 100, (W * 1.3) / 100);
    const c = SLEIGH;
    const dur = c.dur * 1000;
    // 달을 지나는 순간의 진행도. 처음 열고 5초쯤 뒤에 달에 닿도록 출발 자리를 맞춘다. 움직임 줄이기에서는 달 앞에 세워 둔다
    const uMoon = (122 - MOON.x) / 144;
    const u = reduce ? uMoon - 0.02 : ((t - t0) / dur + uMoon - 5000 / dur + 1.18) % 1.18;
    const xp = 122 - 144 * u;
    const yS = MOON.y + (c.slope * (xp - MOON.x)) / 100 + c.arc * Math.pow((xp - MOON.x) / 50, 2);
    const w = c.size * s * (W < 700 ? c.mk : 1);
    const h = w * c.ratio;
    const ang = (Math.atan(((c.slope / 100 + (2 * c.arc * (xp - MOON.x)) / 2500) * s) / (W / 100)) * 180) / Math.PI;
    const bob = reduce ? 0 : Math.sin(t * 0.004) * 0.5 * s;
    sleigh.x = (xp / 100) * W - w / 2;
    sleigh.y = yS * s - w * c.cy + bob;
    if (sleigh.grab) {
      // 잡고 있는 동안에도 길의 시간은 흐른다 — 놓으면 앞질러 간 자리를 쫓아간다
      sleigh.ox = sleigh.px - sleigh.gx - sleigh.x;
      sleigh.oy = sleigh.py - sleigh.gy - sleigh.y;
    } else if (sleigh.ox || sleigh.oy) {
      const keep = Math.exp(-dt / 0.38);
      sleigh.ox *= keep;
      sleigh.oy *= keep;
      if (Math.abs(sleigh.ox) < 0.3 && Math.abs(sleigh.oy) < 0.3) sleigh.ox = sleigh.oy = 0;
    }
    const tf = `translate(${(sleigh.x + sleigh.ox).toFixed(1)}px, ${(sleigh.y + sleigh.oy).toFixed(1)}px) rotate(${ang.toFixed(2)}deg)`;
    sleighEl.style.width = `${w.toFixed(1)}px`;
    sleighEl.style.height = `${h.toFixed(1)}px`;
    sleighEl.style.transform = tf;
    if (sleighHit) {
      sleighHit.style.width = `${w.toFixed(1)}px`;
      sleighHit.style.height = `${h.toFixed(1)}px`;
      sleighHit.style.transform = tf;
    }
  }

  function drawSnow(dt: number, t: number) {
    if (!snow) return;
    const g = snow.cv.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, snow.W, snow.H);
    for (const p of snow.list) {
      p.y += p.vy * dt;
      p.x += (SNOW.wind * 60 + Math.sin(t * 0.0007 + p.ph) * 14) * dt * (0.5 + p.z);
      if (p.y > snow.H + 8) {
        p.y = -8;
        p.x = Math.random() * snow.W;
      }
      if (p.x > snow.W + 8) p.x = -8;
      g.beginPath();
      g.fillStyle = `rgba(244,248,254,${p.a})`;
      g.arc(p.x, p.y, p.r, 0, 6.283);
      g.fill();
    }
  }

  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    if (document.hidden) return;
    sleighAt(t, dt);
    if (playStep) playStep(dt);
    if (reduce) return;
    stepSwings(dt, t);
    drawSnow(dt, t);
    // 마우스 시차: 가까운 겹일수록 많이 움직인다
    ptr.x += (ptr.tx - ptr.x) * 0.05;
    ptr.y += (ptr.ty - ptr.y) * 0.05;
    for (const l of layers) l.el.style.transform = `translate3d(${(-ptr.x * 8 * l.par).toFixed(2)}px, ${(-ptr.y * 8 * 0.35 * l.par).toFixed(2)}px, 0)`;
  }

  /** 홈 — 스크롤한 만큼(0→1) 장면이 가라앉으며 흐려진다. 값 하나만 넣고 화면은 CSS 가 그린다(season.css). */
  function onScroll() {
    if (!home) return;
    const sy = clamp((window.scrollY - window.innerHeight * 0.25) / (window.innerHeight * 0.55), 0, 1);
    back.style.setProperty("--sy", sy.toFixed(3));
    front.style.setProperty("--sy", sy.toFixed(3));
    // 앞 겹은 사이트 글보다 위에 떠 있다 — 히어로를 지나면 눌리지 않게 한다
    const next = sy > 0.25;
    if (next !== off) {
      off = next;
      front.classList.toggle("xmas-sc-off", off);
    }
  }

  function onPointer(e: PointerEvent) {
    if (e.pointerType !== "mouse" || reduce) return;
    ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  let resizeTimer = 0;
  let lw = window.innerWidth;
  let lh = window.innerHeight;
  function onResize() {
    // 휴대폰 주소창이 접히며 높이만 조금 바뀌는 것은 무시한다(눈이 처음부터 다시 내린다)
    if (window.innerWidth === lw && Math.abs(window.innerHeight - lh) < 120) return;
    lw = window.innerWidth;
    lh = window.innerHeight;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  }

  build();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(resizeTimer);
    window.clearTimeout(game.timer);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("resize", onResize);
    cleanups.splice(0).forEach((fn) => fn());
    back.textContent = "";
    front.textContent = "";
    back.style.removeProperty("--sy");
    front.style.removeProperty("--sy");
    front.classList.remove("xmas-sc-off");
  };
}
