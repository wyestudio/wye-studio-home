"use client";

import { useLayoutEffect } from "react";
import { fitPoster, fitPosterAndReveal } from "./posterFitScript";

/**
 * 포스터 크기 맞추기의 클라이언트 쪽. 계산은 posterFitScript.ts 에 있다.
 *
 * 첫 로드는 page.tsx 의 인라인 스크립트가 화면이 그려지기 전에 맞춘다. 이 컴포넌트는
 *   - 다른 화면에서 넘어올 때(클라이언트 이동에서는 인라인 스크립트가 실행되지 않는다)
 *   - 창 크기가 바뀌거나 글꼴이 늦게 적용돼 오른쪽 높이가 바뀔 때
 * 다시 맞춘다. useLayoutEffect 라 넘어온 화면이 그려지기 전에 끝난다.
 *
 * ⚠️ 모바일(768px 미만)은 손대지 않는다. 포스터 옆이 난이도·소요시간뿐이라
 *    그쪽이 포스터 높이에 맞춰 늘어난다(page.tsx).
 */
export function PosterFit({ sectionId }: { sectionId: string }) {
  useLayoutEffect(() => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    let raf = 0;

    if (!section.hasAttribute("data-poster-fit")) fitPosterAndReveal(section, fitPoster);
    else fitPoster(section);

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitPoster(section));
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(section);
    section.querySelectorAll("[data-fit-top],[data-fit-bottom]").forEach((el) => ro.observe(el));
    desktop.addEventListener("change", schedule);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      desktop.removeEventListener("change", schedule);
    };
  }, [sectionId]);

  return null;
}
