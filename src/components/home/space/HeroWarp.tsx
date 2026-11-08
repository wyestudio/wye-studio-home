"use client";

import { useEffect, useRef } from "react";

/**
 * 히어로 뒤의 입체 별 — 화면 안쪽에서 별이 천천히 다가온다.
 *
 * 행성 장면(spaceScene.ts)과 같은 원근(FOCAL / z)이다. 별마다 깊이(z)가 있고 카메라가 앞으로
 * 나아가므로, 가까운 별일수록 빨리 커지며 화면 밖으로 빠져나간다 — 평면 별에는 없는 깊이.
 *
 * - 스크롤해서 히어로를 벗어나는 동안(local 0.55 → 1) 빨라지며 꼬리가 길어진다. 다음 장면
 *   (행성계)으로 날아 들어가는 연결.
 * - 마우스를 움직이면 소실점이 반대로 조금 밀린다(가장 먼 겹이라 가장 크게 움직인다).
 * - 화면 밖 · 백그라운드 탭에서는 멈추고, 모션 줄이기에서는 한 장만 그린다.
 */

const FOCAL = 420;
const DEPTH = 2400;
const STAR_RGB = "202, 217, 237";

type Star = { x: number; y: number; z: number; size: number; alpha: number };

export function HeroWarp({ local, pointer }: { local: number; pointer: React.RefObject<{ x: number; y: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localRef = useRef(local);
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    localRef.current = local;
    syncRef.current();
  }, [local]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let raf = 0;
    let last = 0;
    let running = false;
    let onScreen = false;
    let speed = 60;
    let vx = 0;
    let vy = 0;

    const spawn = (z: number): Star => ({
      // 화면보다 넓게 뿌려야 가장자리까지 별이 지나간다
      x: (Math.random() - 0.5) * 2600,
      y: (Math.random() - 0.5) * 1700,
      z,
      size: Math.random() * 1.3 + 0.4,
      alpha: Math.random() * 0.6 + 0.3,
    });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(340, (W * H) / 3600));
      stars = Array.from({ length: n }, () => spawn(Math.random() * DEPTH + 20));
    }

    function draw(dt: number) {
      // 히어로를 벗어나는 동안 빨라진다(워프). 평소엔 아주 느리게 떠간다.
      const exit = Math.min(1, Math.max(0, (localRef.current - 0.55) / 0.45));
      const target = reduce ? 0 : 60 + exit * exit * 2600;
      speed += (target - speed) * Math.min(1, dt * 4);
      // 소실점 — 마우스 반대쪽으로 조금
      const p = pointer.current ?? { x: 0, y: 0 };
      vx += (-p.x * 40 - vx) * Math.min(1, dt * 3);
      vy += (-p.y * 26 - vy) * Math.min(1, dt * 3);
      const cx = W / 2 + vx;
      const cy = H / 2 + vy;

      ctx!.clearRect(0, 0, W, H);
      const streak = Math.min(1, speed / 900);
      for (const s of stars) {
        const z0 = s.z;
        s.z -= speed * dt;
        if (s.z < 20) {
          Object.assign(s, spawn(DEPTH));
          continue;
        }
        const k = FOCAL / s.z;
        const x = cx + s.x * k;
        const y = cy + s.y * k;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        // 가까워질수록 밝게 · 크게. 먼 별은 희미하게 시작해 나타난다.
        const near = 1 - s.z / DEPTH;
        const a = s.alpha * Math.min(1, near * 1.6);
        const r = s.size * (0.4 + near * 1.4);
        if (streak > 0.05) {
          // 빠를 때는 지나온 자리에서 지금 자리까지 선으로 — 꼬리
          const kp = FOCAL / Math.min(DEPTH, z0 + speed * dt * 6 * streak);
          ctx!.strokeStyle = `rgba(${STAR_RGB}, ${a})`;
          ctx!.lineWidth = r;
          ctx!.beginPath();
          ctx!.moveTo(cx + s.x * kp, cy + s.y * kp);
          ctx!.lineTo(x, y);
          ctx!.stroke();
        } else {
          ctx!.fillStyle = `rgba(${STAR_RGB}, ${a})`;
          ctx!.fillRect(x, y, r, r);
        }
      }
    }

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      draw(dt);
    };

    /*
      ⚠️ 화면 안(IntersectionObserver)만으로는 부족하다. 히어로는 빠져나갈 때 자리를 비키지 않고
         투명해지기만 해서(SceneShell fade), 다음 장면들을 보는 동안에도 "화면 안" 으로 잡힌다.
         히어로를 다 지나면(local ≥ 0.99) 멈춘다 — 안 보이는 별을 계속 그리면 휴대폰 배터리만 쓴다.
    */
    const sync = () => {
      const should = onScreen && !document.hidden && !reduce && localRef.current < 0.99;
      if (should && !running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    syncRef.current = sync;
    resize();
    draw(0);
    const ro = new ResizeObserver(() => {
      resize();
      draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);

    return () => {
      running = false;
      syncRef.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [pointer]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
