"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollStageProgress(reduceMotionFallback = 0.5) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    let raf = 0;
    function computeProgress() {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const next = scrollable > 0 ? Math.min(1, Math.max(0, scrolled / scrollable)) : 0;
      setProgress(next);
    }

    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computeProgress);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(computeProgress);
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  return {
    stageRef,
    progress: reduceMotion ? reduceMotionFallback : progress,
    reduceMotion,
  };
}
