"use client";

import { useState } from "react";

export function useHasHover() {
  const [hasHover] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(hover: hover)").matches;
  });

  return hasHover;
}
