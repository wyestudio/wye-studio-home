"use client";

import { useState } from "react";

// 터치/coarse-pointer 기기 여부를 판정. useReducedMotion과 동일한 패턴으로
// SSR에서도 안전하도록 useState 초기화 시점에 한 번만 읽는다.
export function useIsTouchDevice() {
  const [isTouchDevice] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches,
  );
  return isTouchDevice;
}
