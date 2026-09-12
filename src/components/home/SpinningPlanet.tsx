"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 자전하는 행성.
 *
 * 그림을 옆으로 미는 게 아니라, **세로줄마다 구면 각도를 계산해서** 원본의
 * 어느 지점을 가져올지 정한다. 그래야 무늬가 가운데선 넓고 가장자리로 갈수록
 * 납작하게 눌리며 넘어간다 — 이 눌림이 "공이 돈다"고 읽히게 하는 전부다.
 *
 * 게임은 보통 스프라이트 시트(경도만 다른 프레임 N장)를 돌린다. 같은 결과를
 * 내지만 테마마다 프레임을 미리 만들어야 한다. 여기서는 어드민에서 올린
 * 로고 한 장으로 실시간 계산한다.
 *
 * ⚠️ 지나온 실패들 — 같은 함정을 다시 파지 말 것.
 *    1. CSS 로 배경을 옆으로 밀기. 구면 눌림이 없어 그림이 지나가는 것으로만
 *       보인다. CSS 만으로는 구면 투영을 만들 수 없다.
 *    2. 한 바퀴를 원본 왕복(0→1→0)에 대응시키기. 이음매는 없어지지만 좌우가
 *       뒤집히며 되돌아와, 지나가는 자리마다 대칭으로 접힌 티가 크게 난다.
 *    지금은 원본을 **가로로 끝과 끝이 이어지는 텍스처**로 먼저 가공한 뒤,
 *    그걸 한 방향으로만 계속 감는다.
 */

/**
 * 픽셀을 못 읽을 때 쓰는 반지름 비율(짧은 변의 절반 대비).
 *
 * ⚠️ 이 값이 크면 원반 **바깥의 어두운 테두리가 표면 무늬로 딸려 들어와**,
 *    펼친 텍스처 양 끝이 시커멓게 번지고 행성이 지저분해 보인다. 평소에는
 *    아래 measureDisc() 가 실제 테두리 두께를 재서 쓰고, 이건 최후의 값이다.
 */
const FALLBACK_TRIM = 0.8;

/**
 * 이음매를 지울 때 사본을 겹치는 범위(폭 대비).
 *
 * ⚠️ 넓게 잡으면 안 된다. 겹쳐진 두 벌이 표면 전체에서 이중노출처럼 섞여
 *    색이 뿌옇게 뜬다 — 행성이 지저분해 보이던 원인. 이음매 근처만 살짝.
 */
const SEAM_BAND = 0.06;

/** 한 바퀴 도는 데 걸리는 시간(초). 자전은 눈에 거슬리지 않게 느려야 한다. */
const PERIOD_SEC = 24;

/**
 * 가공한 표면 텍스처 크기. 원본(픽셀아트)보다 크게 잡아 부드럽게 늘려두면
 * 세로줄로 잘라 쓸 때 계단이 덜 보인다 — 커질수록 화질이 깨져 보이던 원인.
 * 가로는 360°, 세로는 극에서 극까지라 2:1 이 자연스럽다.
 */
const TEX_W = 1024;
const TEX_H = 512;

type Disc = { cx: number; cy: number; r: number };

/**
 * 원반의 중심과 **테두리를 뺀** 반지름을 실제 픽셀에서 잰다.
 *
 * 로고마다 테두리 두께가 달라서 비율을 상수로 박아두면 어떤 로고는 테두리가
 * 묻어 들어오고 어떤 로고는 쓸 수 있는 면을 버리게 된다. 그래서 중심에서
 * 72 방향으로 바깥부터 훑어 들어오며, 테두리(거의 검고 어두운 띠)를 벗어나
 * 처음 만나는 지점을 각각 기록하고 그중 짧은 쪽(10 퍼센타일)을 쓴다.
 *
 * 픽셀을 못 읽으면(CORS 로 캔버스가 오염된 경우) null 을 준다.
 */
function measureDisc(img: HTMLImageElement): Disc | null {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const scale = Math.min(1, 256 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const pc = probe.getContext("2d", { willReadFrequently: true });
  if (!pc) return null;
  pc.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = pc.getImageData(0, 0, w, h).data;
  } catch {
    return null; // 캔버스가 오염됐다 — 비율 상수로 물러난다.
  }

  const lumAt = (i: number) =>
    (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;

  // 불투명한 부분의 테두리 상자 → 중심과 바깥 반지름
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  const hist = new Array(256).fill(0);
  let opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] <= 128) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      hist[Math.round(lumAt(i) * 255)] += 1;
      opaque += 1;
    }
  }
  if (opaque === 0 || x1 < x0 || y1 < y0) return null;

  let seen = 0;
  let median = 0;
  for (let v = 0; v < 256; v++) {
    seen += hist[v];
    if (seen >= opaque / 2) {
      median = v / 255;
      break;
    }
  }

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const outer = Math.min(x1 - x0, y1 - y0) / 2;
  const floorLum = 0.45 * median;

  const hits: number[] = [];
  const RAYS = 72;
  for (let k = 0; k < RAYS; k++) {
    const a = (2 * Math.PI * k) / RAYS;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let found = outer * 0.2;
    for (let d = outer; d > outer * 0.2; d -= 0.5) {
      const x = Math.round(cx + dx * d);
      const y = Math.round(cy + dy * d);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] > 200 && lumAt(i) > floorLum) {
        found = d;
        break;
      }
    }
    hits.push(found);
  }
  hits.sort((a, b) => a - b);

  // 가장 짧은 방향에 맞춰야 테두리가 안 묻는다. 픽셀아트라 가장자리가 톱니라
  // 최솟값 대신 10 퍼센타일을 쓰고 살짝 더 깎는다.
  const usable = hits[Math.floor(hits.length * 0.1)] * 0.97;
  return { cx: cx / scale, cy: cy / scale, r: usable / scale };
}

/**
 * 원본 행성 그림을 **가로로 감기는(tileable) 표면 텍스처**로 펼친다.
 *
 * 원본은 이미 구면에 입혀 렌더된 그림이라, 그대로 잘라 쓰면 이미 눌려 있는
 * 무늬를 한 번 더 누르게 된다. 그래서 먼저 눌림을 되돌려 평평하게 편다.
 *
 *  1단계 — 위도 방향. 구면에서는 극으로 갈수록 가로로 좁아 보이므로
 *          (폭이 cos(위도) 배), 각 줄을 그 비율만큼 도로 늘린다. 덤으로 원반
 *          **바깥을 아예 읽지 않게 돼** 모서리에 테두리가 묻어 들어오지 않는다.
 *  2단계 — 경도 방향. 가로 위치가 sin(경도) 이므로, 경도가 고르게 퍼지도록
 *          되돌린다.
 *
 * 이렇게 펴면 **보이는 반구(180°) 전체**를 쓰게 된다. 원 안에 꼭 들어가는
 * 정사각형만 잘라 쓰던 예전 방식보다 원본 픽셀을 1.7 배쯤 더 쓰므로, 같은
 * 크기로 그려도 확대되어 깨져 보이지 않는다.
 *
 * 마지막으로 끝과 끝을 이어 붙인다. 반 칸 민 사본은 좌우 끝이 원본의 가운데라
 * 자기들끼리는 이어지고 대신 한가운데에 이음매가 생기는데, 그 사본을
 * 가장자리에서 진하고 가운데서 투명한 알파로 겹치면 — 끝과 끝은 사본 값으로
 * 이어지고, 이음매 자리는 가중치가 0 이라 드러나지 않는다.
 */
function buildTileableTexture(img: HTMLImageElement): HTMLCanvasElement | null {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) return null;

  const disc = measureDisc(img) ?? {
    cx: sw / 2,
    cy: sh / 2,
    r: (Math.min(sw, sh) / 2) * FALLBACK_TRIM,
  };
  const { cx, cy, r: R } = disc;

  const make = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (g) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
    }
    return { c, g };
  };

  // 1단계 — 위도별 가로 압축 되돌리기. 가로줄 하나씩.
  const { c: flat, g: fc } = make(TEX_W, TEX_H);
  if (!fc) return null;
  for (let row = 0; row < TEX_H; row++) {
    const sin = (2 * (row + 0.5)) / TEX_H - 1;
    const cos = Math.sqrt(Math.max(1 - sin * sin, 1e-4));
    const half = R * cos;
    fc.drawImage(img, cx - half, cy + R * sin - 0.5, half * 2, 1, 0, row, TEX_W, 1);
  }

  // 2단계 — 경도 방향 sin 되돌리기. 세로줄 하나씩.
  const { c: tile, g: tc } = make(TEX_W, TEX_H);
  if (!tc) return null;
  for (let j = 0; j < TEX_W; j++) {
    const lam = -Math.PI / 2 + (Math.PI * (j + 0.5)) / TEX_W;
    const u = ((Math.sin(lam) + 1) / 2) * TEX_W;
    const w = Math.max(0.5, (Math.PI * Math.cos(lam)) / 2);
    tc.drawImage(flat, u - w / 2, 0, w, TEX_H, j, 0, 1, TEX_H);
  }

  // 이음매 지우기 — 반 칸 민 사본을 가장자리에서만 진하게 겹친다.
  const { c: shifted, g: sc } = make(TEX_W, TEX_H);
  if (!sc) return null;
  sc.drawImage(tile, TEX_W / 2, 0, TEX_W / 2, TEX_H, 0, 0, TEX_W / 2, TEX_H);
  sc.drawImage(tile, 0, 0, TEX_W / 2, TEX_H, TEX_W / 2, 0, TEX_W / 2, TEX_H);
  const ramp = sc.createLinearGradient(0, 0, TEX_W, 0);
  ramp.addColorStop(0, "rgba(0,0,0,1)");
  ramp.addColorStop(SEAM_BAND, "rgba(0,0,0,0)");
  ramp.addColorStop(1 - SEAM_BAND, "rgba(0,0,0,0)");
  ramp.addColorStop(1, "rgba(0,0,0,1)");
  sc.globalCompositeOperation = "destination-in";
  sc.fillStyle = ramp;
  sc.fillRect(0, 0, TEX_W, TEX_H);
  tc.drawImage(shifted, 0, 0);

  // 감아 쓰기 편하도록 가로로 두 벌 이어 붙인다. 경도가 끝을 넘어가도
  // 한 번의 drawImage 로 잘라낼 수 있다.
  const { c: tex, g: xc } = make(TEX_W * 2, TEX_H);
  if (!xc) return null;
  xc.drawImage(tile, 0, 0);
  xc.drawImage(tile, TEX_W, 0);
  return tex;
}

export function SpinningPlanet({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 모션을 줄여 달라고 한 사용자에게는 돌리지 않는다. 정지 이미지가 그대로 남는다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const img = new Image();
    // 테두리 두께를 재려면 픽셀을 읽어야 하고, 그러려면 CORS 허용이 필요하다.
    // 헤더가 없는 곳에서 올린 이미지는 로드 자체가 실패하므로, 그때는 지정
    // 없이 한 번 더 시도한다 — 그림은 뜨고 테두리만 비율 상수로 물러난다.
    let retried = false;
    img.crossOrigin = "anonymous";
    img.onerror = () => {
      if (retried) return;
      retried = true;
      img.removeAttribute("crossorigin");
      img.src = src;
    };
    img.src = src;

    let raf = 0;
    let angle = 0;
    let last = 0;
    let paused = false;
    let visible = true;
    let tex: HTMLCanvasElement | null = null;
    let res = 0;

    // 중간 버퍼. 위도 압축을 넣기 전, '적도 기준'으로 펼친 상태를 먼저 그린다.
    const warp = document.createElement("canvas");
    const wctx = warp.getContext("2d");
    if (!wctx) return;

    // 커서를 올리면 멈춘다 — "지령을 받는 동안 행성이 정지" 하는 연출.
    // 판정 범위는 행성 자리(부모)까지다. 카드 전체에 걸면 옆의 빈 자리에
    // 커서만 올려도 멈춰서 무엇을 가리키는지가 흐려진다.
    const hoverTarget = canvas.parentElement;
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    hoverTarget?.addEventListener("pointerenter", onEnter);
    hoverTarget?.addEventListener("pointerleave", onLeave);

    // 화면 밖에서는 그리지 않는다.
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, {
      rootMargin: "200px",
    });
    io.observe(canvas);

    /** 한 번에 그리는 줄 너비(px). 1 이면 가장 매끄럽지만 호출 수가 그만큼 는다. */
    const SLICE = 1;

    function syncSize() {
      // 실제 표시 크기 × 화면 배율. 세로줄 하나씩 그리는 방식이라 비용이
      // 가로 픽셀 수에 비례하므로 상한을 둔다.
      //
      // ⚠️ 배율 1 인 화면에서도 최소 2배로 그린다. 등배로 그리면 세로줄 하나가
      //    화면 한 픽셀이라 계단이 그대로 드러난다 — 화질이 깨져 보이던 원인.
      const dpr = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
      const next = Math.min(Math.round((canvas!.clientWidth || 144) * dpr), 512);
      if (next > 0 && next !== res) {
        res = next;
        canvas!.width = res;
        canvas!.height = res;
        warp.width = res;
        warp.height = res;
        for (const g of [ctx!, wctx!]) {
          g.imageSmoothingEnabled = true;
          g.imageSmoothingQuality = "high";
        }
      }
    }

    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      if (!last) last = now;
      const dt = (now - last) / 1000;
      last = now;
      if (!paused && visible) angle += (dt / PERIOD_SEC) * Math.PI * 2;
      if (!visible || !tex) return;

      syncSize();
      const r = res / 2;

      // ── 1차: 적도 기준으로 펼치기 ──
      // 위도에 따른 가로 압축은 아직 넣지 않는다. 여기서는 가로 위치를
      // '적도에서의 위치' 로만 본다.
      wctx!.clearRect(0, 0, res, res);
      for (let i = 0; i < res; i += SLICE) {
        // 화면 가로 위치 → 구면 경도. 정사영에서 x = sin(경도) 이므로 경도는 asin(x).
        const nx = (i + SLICE / 2 - r) / r;
        if (nx <= -1 || nx >= 1) continue;
        const cos = Math.sqrt(1 - nx * nx);
        const lambda = Math.asin(nx) + angle;

        // 경도 → 텍스처 가로 위치. 텍스처가 보이는 반구(π)를 폭 전체에 담고
        // 끝과 끝이 이어지므로, 한 방향으로 계속 감기만 하면 된다. 두 벌 이어
        // 붙여 뒀으므로 가운데 벌을 쓴다.
        //
        // 뒷면은 원본에 없어서 같은 반구가 한 바퀴에 두 번 지나간다. 이음매를
        // 지워 뒀기 때문에 어디가 경계인지 보이지 않는다.
        const u = (((lambda / Math.PI) % 1) + 1) % 1;
        const tx = TEX_W * (0.5 + u);

        // 이 한 줄이 담아야 할 텍스처 폭.
        //   du/di = 1 / (π · r · cos)  →  가장자리(cos→0)로 갈수록 급격히 넓어진다.
        // **이 넓어짐이 곧 구면 눌림이다.** 가장자리 한 줄에 넓은 범위가 압축돼
        // 들어가면서 무늬가 납작해지고, 그래야 공이 도는 것으로 읽힌다.
        const span = Math.min((TEX_W * SLICE) / (Math.PI * r * cos), TEX_W);

        wctx!.drawImage(tex!, tx - span / 2, 0, span, TEX_H, i, 0, SLICE, res);
      }

      // ── 2차: 위도별 가로 압축 ──
      // 위도 φ 줄은 폭이 cos(φ) 배로 줄어든다. 이걸 넣어야 극 쪽 무늬가
      // 가운데로 오므라들고, 덤으로 실루엣이 저절로 정확한 원이 된다.
      ctx!.clearRect(0, 0, res, res);
      for (let y = 0; y < res; y++) {
        const sin = (2 * (y + 0.5)) / res - 1;
        const cos = Math.sqrt(Math.max(1 - sin * sin, 0));
        if (cos <= 0) continue;
        const w = res * cos;
        ctx!.drawImage(warp, 0, y, res, 1, (res - w) / 2, y, w, 1);
      }
    }

    img.onload = () => {
      tex = buildTileableTexture(img);
      if (!tex) return;
      syncSize();
      setReady(true);
      raf = requestAnimationFrame(draw);
    };

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      hoverTarget?.removeEventListener("pointerenter", onEnter);
      hoverTarget?.removeEventListener("pointerleave", onLeave);
    };
  }, [src]);

  return (
    <>
      {/* 캔버스가 준비되기 전(또는 모션 줄이기)에는 원본 그림이 그대로 보인다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${className} ${ready ? "opacity-0" : ""}`}
        aria-hidden={ready}
      />
      <canvas ref={canvasRef} className={`${className} ${ready ? "" : "opacity-0"}`} aria-hidden />
    </>
  );
}
