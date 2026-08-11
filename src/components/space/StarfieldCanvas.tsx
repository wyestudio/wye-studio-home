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

const STAR_DENSITY = 1 / 9000; // stars per px^2

export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: Star[] = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    function seedStars() {
      const count = Math.round(width * height * STAR_DENSITY);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.2 + 0.3,
        baseAlpha: Math.random() * 0.5 + 0.3,
        driftSpeed: Math.random() * 0.015 + 0.005,
        phase: Math.random() * Math.PI * 2,
      }));
    }

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
      seedStars();
    }

    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        const twinkle = reduceMotion ? 0 : Math.sin(time * star.driftSpeed + star.phase) * 0.35;
        ctx.beginPath();
        ctx.fillStyle = `rgba(228, 232, 255, ${Math.max(0, star.baseAlpha + twinkle)})`;
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduceMotion) {
        frameId = requestAnimationFrame(draw);
      }
    }

    resize();
    draw(0);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
