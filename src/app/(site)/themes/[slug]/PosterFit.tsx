"use client";

import { useLayoutEffect } from "react";

/**
 * 데스크톱에서 포스터를 **비율(4:5) 그대로** 오른쪽 정보 높이만큼 키운다.
 *
 * 왜 스크립트인가
 *   포스터 칸을 늘려 object-cover 로 채웠더니 그림이 확대돼 양옆이 잘렸다
 *   (2026-09-15). 비율을 지키며 높이를 맞추려면 **폭을 오른쪽 높이에서 거꾸로**
 *   정해야 하는데, 오른쪽 높이는 글자가 줄바꿈된 뒤에야 정해진다. CSS 만으로는
 *   '옆 칸 높이 → 내 폭' 을 표현할 수 없어서 그려진 뒤 재서 맞춘다.
 *
 * 어떻게
 *   오른쪽 첫 요소([data-fit-top]) 위끝 ~ 마지막 요소([data-fit-bottom]) 아래끝을
 *   재서 그 높이 × 0.8 을 포스터 칸 폭(--poster-w)으로 넣는다.
 *   포스터가 넓어지면 오른쪽이 좁아져 줄이 늘 수 있으므로 몇 번 더 재서 맞춘다.
 *   (폭이 늘면 높이는 줄지 않으니 값이 한쪽으로만 움직여 금방 멈춘다.)
 *
 * ⚠️ 오른쪽 요소들은 self-start 여야 한다. 칸 높이만큼 늘어나 있으면 포스터가
 *    커질수록 잰 높이도 같이 커져 끝없이 커진다.
 * ⚠️ 폭은 위아래 한도를 둔다. 오른쪽이 아주 길면 포스터가 화면을 다 먹고,
 *    아주 짧으면 우표만 해진다. 한도에 걸리면 높이는 맞지 않는다.
 * ⚠️ 모바일(768px 미만)은 손대지 않는다. 포스터 옆이 난이도·소요시간뿐이라
 *    그쪽이 포스터 높이에 맞춰 늘어난다(page.tsx).
 */
const MIN_W = 240;
const MAX_W = 460;
/** 포스터 칸이 섹션 폭에서 차지할 수 있는 최대 비율. 오른쪽 글이 너무 좁아지지 않게. */
const MAX_SHARE = 0.46;

export function PosterFit({ sectionId }: { sectionId: string }) {
  useLayoutEffect(() => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    let raf = 0;

    const fit = () => {
      if (!desktop.matches) {
        section.style.removeProperty("--poster-w");
        return;
      }
      for (let i = 0; i < 8; i++) {
        const top = section.querySelector<HTMLElement>("[data-fit-top]");
        const bottoms = section.querySelectorAll<HTMLElement>("[data-fit-bottom]");
        if (!top || bottoms.length === 0) return;

        const bottom = Math.max(...[...bottoms].map((el) => el.getBoundingClientRect().bottom));
        const height = bottom - top.getBoundingClientRect().top;
        const max = Math.min(MAX_W, section.clientWidth * MAX_SHARE);
        const next = Math.round(Math.max(MIN_W, Math.min(max, height * 0.8)));

        const current = parseFloat(section.style.getPropertyValue("--poster-w")) || 0;
        if (Math.abs(next - current) < 1) break;
        section.style.setProperty("--poster-w", `${next}px`);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };

    fit();
    // 글꼴이 늦게 로드되거나 창 크기가 바뀌면 줄바꿈이 달라져 높이가 바뀐다.
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
