"use client";

import { useSyncExternalStore } from "react";

/**
 * 미디어 쿼리 판정(움직임 줄이기 · 터치 기기 · 마우스 여부).
 *
 * ⚠️ useState 초기화에서 window.matchMedia 를 바로 읽지 않는다. 서버는 기기를 모르니
 *    serverValue 로 그리는데, 브라우저가 첫 화면부터 다른 값으로 그리면 "Hydration failed"
 *    가 나고 화면을 통째로 다시 그린다. 홈에서 '움직임 줄이기'를 켠 폰이 실제로 그랬다
 *    (2026-10-23). 여기서는 첫 화면을 serverValue 로 맞춘 뒤 바로 실제 값으로 바꾼다.
 */
export function useMediaQuery(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
