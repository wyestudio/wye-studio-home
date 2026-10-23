"use client";

import { useMediaQuery } from "@/lib/useMediaQuery";

// 다른 space/* 컴포넌트들과 동일한 판정 방식(window.matchMedia)을 훅 하나로 공용화.
export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)", false);
}
