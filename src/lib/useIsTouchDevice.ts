"use client";

import { useMediaQuery } from "@/lib/useMediaQuery";

// 터치/coarse-pointer 기기 여부를 판정.
export function useIsTouchDevice() {
  return useMediaQuery("(hover: none)", false);
}
