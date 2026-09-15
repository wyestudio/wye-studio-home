"use client";

import { useEffect } from "react";

/**
 * 마우스 휠 한 번에 다음(이전) 화면 블록으로 넘어간다.
 *
 * 블록마다 화면 높이를 채우자 여백 덕에 보기는 편해졌지만 스크롤이 오래 걸린다는
 * 의견(2026-09-15). [data-screen] 이 붙은 블록 단위로 넘긴다.
 *
 * 긴 블록(후기 등 화면보다 긴 것)
 *   바로 넘기지 않고 평소처럼 스크롤된다. **블록 끝이 화면 가운데까지 올라온 뒤**
 *   휠을 내리면 다음 블록으로 넘어간다. 올릴 때는 블록 윗끝이 헤더 밑까지 내려온 뒤
 *   한 번 더 올리면 이전 블록으로 간다.
 *
 * ⚠️ 휠만 가로챈다. 터치(모바일)·키보드·스크롤바 끌기는 평소대로 둔다 — 손가락으로
 *    밀 때 강제로 넘기면 조작이 막힌 느낌이 든다.
 * ⚠️ 트랙패드는 한 번 쓸면 휠 이벤트가 관성으로 1초 가까이 쏟아진다. 넘기는 중과
 *    넘긴 직후 이벤트가 잠잠해질 때까지는 추가 휠을 먹어서 두 칸씩 넘어가지 않게 한다.
 * ⚠️ 가로 휠(후기 슬라이더를 옆으로 밀기)·확대(ctrl+휠)는 건드리지 않는다.
 */
const DURATION = 650;
/** 휠이 이만큼 조용해야 잠금을 푼다(트랙패드 관성 흡수). */
const QUIET_MS = 180;
/** 이만큼 작은 휠 움직임은 무시한다(트랙패드 미세 떨림). */
const MIN_DELTA = 4;

export function ScreenSnap() {
  useEffect(() => {
    let animating = false;
    /** 넘김을 시작한 순간부터, 넘김이 끝나고 휠이 잠잠해질 때까지 true. */
    let locked = false;
    let lastWheel = 0;
    let raf = 0;

    const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /**
     * 화면 위에 붙어 따라오는 줄(헤더, 모바일은 섹션 이동 탭까지)의
     *   bottom : 지금 화면에서의 아래끝 — '지금 블록' 을 찾는 기준선
     *   height : 붙어 있을 때의 높이 합 — 블록이 한 화면에 들어오는지 재는 기준
     * ⚠️ 둘을 나눈 이유: 테스트 서버는 맨 위에 'TEST 환경' 띠가 있어 페이지 맨 위에서만
     *    헤더 아래끝이 띠 높이만큼 내려가 있다. 그 값으로 화면 높이를 재면 첫 화면이
     *    '화면보다 긴 블록' 으로 잘못 판정돼 휠이 넘어가지 않았다.
     */
    const stickyEdge = () => {
      let bottom = 0;
      let height = 0;
      document.querySelectorAll<HTMLElement>("header, nav[aria-label='섹션 이동']").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && getComputedStyle(el).position === "sticky") {
          bottom = Math.max(bottom, r.bottom);
          height += r.height;
        }
      });
      return { bottom, height };
    };

    const animateTo = (target: number) => {
      const start = window.scrollY;
      const dist = target - start;
      if (Math.abs(dist) < 2) return;
      if (reduceMotion()) {
        window.scrollTo(0, target);
        return;
      }
      animating = true;
      const t0 = performance.now();
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION);
        window.scrollTo(0, start + dist * ease(t));
        if (t < 1) raf = requestAnimationFrame(step);
        else animating = false;
      };
      raf = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const now = performance.now();

      // 넘기는 중이거나 직전 넘김의 관성이 남아 있으면 먹는다.
      if (locked) {
        if (animating || now - lastWheel < QUIET_MS) {
          e.preventDefault();
          lastWheel = now;
          return;
        }
        locked = false;
      }
      if (Math.abs(e.deltaY) < MIN_DELTA) return;

      const screens = [...document.querySelectorAll<HTMLElement>("[data-screen]")];
      if (screens.length === 0) return;

      const { bottom: top, height: stickyH } = stickyEdge();
      const vh = window.innerHeight;
      const center = top + (vh - top) / 2;
      const view = vh - stickyH;
      // 헤더 바로 아래 줄이 걸쳐 있는 블록이 '지금 블록'.
      const line = top + 2;
      const idx = screens.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= line && r.bottom > line;
      });

      // 넘어간 뒤에는 헤더가 맨 위에 붙어 있으므로 붙어 있을 때 높이(stickyH)만큼 띄운다.
      const targetOf = (el: HTMLElement) =>
        Math.max(0, window.scrollY + el.getBoundingClientRect().top - stickyH);

      let target: number | null = null;

      if (idx === -1) {
        // 블록 사이 틈이나 푸터. 아래로는 가장 가까운 다음 블록, 위로는 마지막으로 지나친 블록.
        if (e.deltaY > 0) {
          const next = screens.find((el) => el.getBoundingClientRect().top > line);
          if (next && next.getBoundingClientRect().top < vh) target = targetOf(next);
        } else {
          const prev = [...screens].reverse().find((el) => el.getBoundingClientRect().bottom <= line);
          // 푸터에서 올리는 경우 — 마지막 블록 윗끝으로.
          if (prev) target = targetOf(prev);
        }
      } else {
        const cur = screens[idx];
        const r = cur.getBoundingClientRect();
        const tall = r.height > view + 4;

        if (e.deltaY > 0) {
          const next = screens[idx + 1];
          // 긴 블록 안: 끝이 가운데까지 올라올 때까진 평소대로.
          // 단, 남은 거리가 휠 한 번보다 짧으면 어중간하게 멈추지 말고 바로 넘긴다.
          if (tall && r.bottom - center > Math.abs(e.deltaY)) {
            target = null;
          } else if (next) {
            target = targetOf(next);
          }
          // 마지막 블록이면 평소대로(푸터로 내려간다).
        } else {
          const aligned = Math.abs(r.top - top) < 4;
          // 긴 블록 안: 윗끝이 헤더 밑에 올 때까진 평소대로.
          // 남은 거리가 휠 한 번보다 짧으면 이 블록 윗끝에 멈추지 않고 바로 이전 블록으로 간다
          // — 안 그러면 이전 블록이 살짝 보이는 어중간한 자리에 한 번 멈춘다.
          const nearTop = tall && r.top < top && top - r.top <= Math.abs(e.deltaY);
          if (!aligned && !nearTop) {
            // 블록 중간에 걸쳐 있다.
            if (tall && r.top < top) target = null;
            else target = targetOf(cur);
          } else if (idx > 0) {
            const prev = screens[idx - 1];
            const pr = prev.getBoundingClientRect();
            // 이전 블록이 길면 윗끝이 아니라 끝부분(끝이 화면 가운데)이 보이게 돌아간다.
            target =
              pr.height > view + 4
                ? Math.max(0, window.scrollY + pr.bottom - center)
                : targetOf(prev);
          } else {
            target = 0;
          }
        }
      }

      if (target === null) return;
      e.preventDefault();
      lastWheel = now;
      locked = true;
      animateTo(target);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
