"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  driftSpeed: number;
  phase: number;
};

/**
 * 사이트 전체 배경 별 — 깊이가 다른 두 겹.
 *
 *   중간 별   작은 회백색 각진 점. 스크롤 · 마우스에 조금 움직인다.
 *   가까운 별 몇 개 안 되는 크고 번지는 별. 가장 많이 움직인다.
 *
 * 스크롤하거나 마우스를 움직이면 가까운 것일수록 많이 움직인다(시차) — 한 장에 다 그리면
 * 화면에 붙은 점처럼 보인다. 바탕은 왼쪽 위에서 번지는 보랏빛 그라데이션, 그 위에 옅은 빛무리와
 * 가장자리 어둠.
 *
 * 별은 적게 둔다. 홈 행성계(home/space/spaceScene.ts)가 시점을 따라 움직이는 별을 따로 그려서,
 * 이 별까지 많으면 두 겹이 섞여 어지럽다. 깜빡임도 한 번에 2~6초로 느리게.
 * 배경색은 globals.css 의 --background(#04070d). 모션 줄이기에서는 움직이지 않는다.
 *
 * ⚠️ 은하수(코드로 그린 빛 띠)와 성운 빛무리를 얹어 봤다가 "짜쳐 보인다" 는 말을 듣고 뺐다.
 */
const MID_DENSITY = 1 / 22000; // stars per px^2
const NEAR_DENSITY = 1 / 90000;
const STAR_RGB = "202, 217, 237";
const TWINKLE = 0.18;
/** 가까운 별 밝기 — 콘텐츠보다 튀지 않게 눌러 둔다 */
const NEAR_ALPHA = 0.55;
/** 스크롤 1px 당 움직이는 양 · 마우스로 흔들리는 최대 폭(px) */
const PARALLAX = {
  mid: { scroll: 0.03, pointer: 10 },
  near: { scroll: 0.09, pointer: 26 },
};

export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let mid: Star[] = [];
    let near: Star[] = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    // 마우스 위치(-1~1). 목표 쪽으로 천천히 따라간다.
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;

    const make = (density: number, rMin: number, rMax: number): Star[] =>
      Array.from({ length: Math.max(1, Math.round(width * height * density)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * (rMax - rMin) + rMin,
        baseAlpha: Math.random() * 0.6 + 0.2,
        driftSpeed: Math.random() * 0.002 + 0.001,
        phase: Math.random() * Math.PI * 2,
      }));

    function resize() {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      mid = make(MID_DENSITY, 0.25, 1.35);
      near = make(NEAR_DENSITY, 1.2, 2.2);
    }

    function glow(x: number, y: number, r: number, color: string) {
      if (!ctx) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const wrap = (v: number, m: number) => ((v % m) + m) % m;

    function draw(time: number) {
      if (!ctx) return;
      px += (tx - px) * 0.04;
      py += (ty - py) * 0.04;
      const scrollY = reduceMotion ? 0 : window.scrollY;

      ctx.clearRect(0, 0, width, height);
      glow(width * 0.66, height * 0.53, width * 0.43, "rgba(51, 51, 102, 0.09)");
      glow(width * 0.3, height * 0.6, width * 0.3, "rgba(84, 42, 86, 0.08)");
      const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
      v.addColorStop(0, "rgba(4, 7, 13, 0)");
      v.addColorStop(1, "rgba(4, 7, 13, 0.55)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, width, height);

      // 중간 별 — 각진 작은 점(둥근 점보다 또렷하게 반짝인다)
      for (const star of mid) {
        const twinkle = reduceMotion ? 0 : Math.sin(time * star.driftSpeed + star.phase) * TWINKLE;
        ctx.fillStyle = `rgba(${STAR_RGB}, ${Math.max(0, star.baseAlpha + twinkle)})`;
        const x = wrap(star.x + px * PARALLAX.mid.pointer, width);
        const y = wrap(star.y - scrollY * PARALLAX.mid.scroll + py * PARALLAX.mid.pointer, height);
        ctx.fillRect(x, y, star.radius * 1.4, star.radius * 1.4);
      }

      // 가까운 별 — 또렷한 심 + 가는 십자 빛줄기. 둥근 빛무리를 크게 두르면 "여드름 패치 · 모기
      // 물린 자국" 처럼 보였다(대표님). 빛무리는 심 바로 둘레만 아주 옅게.
      for (const star of near) {
        const twinkle = reduceMotion ? 0 : Math.sin(time * star.driftSpeed + star.phase) * TWINKLE;
        const a = Math.max(0.2, star.baseAlpha + 0.25 + twinkle) * NEAR_ALPHA;
        const x = wrap(star.x + px * PARALLAX.near.pointer, width);
        const y = wrap(star.y - scrollY * PARALLAX.near.scroll + py * PARALLAX.near.pointer, height);
        const core = star.radius * 0.55;
        const spike = star.radius * 4.5;
        // 빛줄기 — 가운데서 끝으로 사라지는 가는 선 네 갈래
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          const g = ctx.createLinearGradient(x - dx * spike, y - dy * spike, x + dx * spike, y + dy * spike);
          g.addColorStop(0, `rgba(${STAR_RGB}, 0)`);
          g.addColorStop(0.5, `rgba(${STAR_RGB}, ${a * 0.7})`);
          g.addColorStop(1, `rgba(${STAR_RGB}, 0)`);
          ctx.fillStyle = g;
          if (dx) ctx.fillRect(x - spike, y - 0.4, spike * 2, 0.8);
          else ctx.fillRect(x - 0.4, y - spike, 0.8, spike * 2);
        }
        const halo = ctx.createRadialGradient(x, y, 0, x, y, core * 3);
        halo.addColorStop(0, `rgba(${STAR_RGB}, ${a * 0.35})`);
        halo.addColorStop(1, `rgba(${STAR_RGB}, 0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(x - core * 3, y - core * 3, core * 6, core * 6);
        ctx.fillStyle = `rgba(240, 244, 252, ${Math.min(1, a * 1.4)})`;
        ctx.beginPath();
        ctx.arc(x, y, core, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) {
        frameId = requestAnimationFrame(draw);
      }
    }

    // 마우스만 — 손가락은 누를 때만 위치가 생겨 별이 튄다
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = (e.clientX / width) * 2 - 1;
      ty = (e.clientY / height) * 2 - 1;
    };

    resize();
    draw(0);
    window.addEventListener("resize", resize);
    if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      // 배경 그라데이션 — 왼쪽 위 모서리에서 보랏빛이 번지고 나머지는 검정. 화면에 고정이라
      // 페이지가 길어도 늘어나지 않는다. 그 위에 별을 그린다. 세 안을 나란히 비교해 대표님이 골랐다.
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 15% 0%, #1a1636 0%, #0a0b1a 45%, #04070d 80%)",
      }}
    />
  );
}
