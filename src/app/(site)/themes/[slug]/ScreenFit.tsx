"use client";

import { useLayoutEffect } from "react";
import { fitScreen } from "./screenFitScript";

/**
 * 화면 블록을 한 화면에 맞추는 계산(screenFitScript.ts)을 언제 다시 돌릴지 정한다.
 *
 * - 처음 뜰 때, 창 크기가 바뀔 때, 글꼴이 다 왔을 때
 * - 블록 내용 높이가 바뀔 때(회차 달력·인스타 후기는 늦게 채워진다)
 *   ⚠️ 단, **지금 보고 있는 블록은 내용이 바뀌어도 다시 맞추지 않는다.** 자주 묻는
 *      질문을 펼칠 때마다 블록이 쪼그라들면 읽던 글자가 움직인다. 화면 밖으로 나간
 *      뒤에 맞춘다. 창 크기가 바뀐 직후만 예외다.
 *
 * 첫 화면(소개)은 page.tsx 의 인라인 스크립트가 그려지기 전에 한 번 맞춘다.
 */
export function ScreenFit() {
  useLayoutEffect(() => {
    const screens = [...document.querySelectorAll<HTMLElement>("[data-screen]")];
    if (screens.length === 0) return;

    const visible = new Set<Element>();
    const pending = new Set<HTMLElement>();
    let resizedAt = 0;
    let raf = 0;

    const fitAll = () => screens.forEach((s) => fitScreen(s));
    fitAll();

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.add(e.target);
        else {
          visible.delete(e.target);
          if (pending.has(e.target as HTMLElement)) {
            pending.delete(e.target as HTMLElement);
            fitScreen(e.target as HTMLElement);
          }
        }
      });
    });

    const ro = new ResizeObserver((entries) => {
      const justResized = performance.now() - resizedAt < 800;
      entries.forEach((e) => {
        const section = (e.target as HTMLElement).closest<HTMLElement>("[data-screen]");
        if (!section) return;
        if (visible.has(section) && !justResized) pending.add(section);
        else fitScreen(section);
      });
    });

    screens.forEach((s) => {
      io.observe(s);
      const inner = s.querySelector("[data-screen-inner]");
      if (inner) ro.observe(inner);
    });

    const onResize = () => {
      resizedAt = performance.now();
      cancelAnimationFrame(raf);
      // 포스터 맞추기(PosterFit)가 먼저 끝나야 소개 블록 높이가 정해진다. 한 프레임 더 늦춘다.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(fitAll);
      });
    };
    window.addEventListener("resize", onResize);

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts && fonts.status !== "loaded") fonts.ready.then(fitAll);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
