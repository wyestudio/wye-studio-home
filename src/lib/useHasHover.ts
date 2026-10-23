"use client";

import { useMediaQuery } from "@/lib/useMediaQuery";

export function useHasHover() {
  return useMediaQuery("(hover: hover)", true);
}
