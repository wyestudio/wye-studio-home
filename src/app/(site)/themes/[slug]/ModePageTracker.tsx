"use client";

import { useEffect } from "react";
import { pagePath, trackPage } from "@/lib/visitTrack";

/**
 * 모드를 바꾸면 경로가 그대로라(?mode= 만 바뀐다) VisitTracker 가 새 화면을 모른다 — 여기서 남긴다.
 * 첫 화면은 VisitTracker 가 같은 경로로 남기고, 같은 경로는 trackPage 가 한 번만 센다. 그리는 것은 없다.
 */
export function ModePageTracker({ mode }: { mode: string }) {
  useEffect(() => {
    trackPage(pagePath());
  }, [mode]);
  return null;
}
