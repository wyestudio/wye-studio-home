"use client";

import { useState } from "react";

// 다른 space/* 컴포넌트들과 동일한 판정 방식(window.matchMedia)을 훅 하나로 공용화.
// useState 초기화 시점에 한 번만 읽어서 SSR에서도 안전하다.
export function useReducedMotion() {
  const [reduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduceMotion;
}
