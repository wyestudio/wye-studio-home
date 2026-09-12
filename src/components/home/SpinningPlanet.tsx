"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 자전하는 행성.
 *
 * 그림을 옆으로 미는 게 아니라, **세로줄마다 구면 각도를 계산해서** 원본의
 * 어느 지점을 가져올지 정한다. 그래야 무늬가 가운데선 넓고 가장자리로 갈수록
 * 납작하게 눌리며 넘어간다 — 이 눌림이 "공이 돈다"고 읽히게 하는 전부다.
 *
 * ⚠️ 처음에는 CSS 로 배경을 옆으로 밀었다. 눌림이 없어서 그림이 지나가는
 *    것으로만 보였고, 배율을 아무리 만져도 해결되지 않았다. CSS 로는 구면
 *    투영을 만들 수 없다.
 *
 * 게임은 보통 스프라이트 시트(경도만 다른 프레임 N장)를 돌린다. 같은 결과를
 * 내지만 테마마다 프레임을 미리 만들어야 한다. 여기서는 어드민에서 올린
 * 로고 한 장으로 실시간 계산한다.
 */

/**
 * 원본 원반에서 잘라 쓸 정사각형의 한 변 (짧은 쪽 기준 비율).
 *
 * ⚠️ 이 값이 크면 원반 **바깥의 어두운 테두리가 표면 무늬로 딸려 들어와**,
 *    돌다가 검은 덩어리가 한가운데를 지나간다. 원 안에 꼭 들어가는 정사각형의
 *    한 변은 지름의 0.707 배지만, 두꺼운 테두리와 계단진 픽셀 가장자리까지
 *    감안하면 0.58 정도까지 줄여야 검은 얼룩이 안 보인다.
 */
const SAMPLE_SPAN = 0.58;

/** 한 바퀴 도는 데 걸리는 시간(초). 자전은 눈에 거슬리지 않게 느려야 한다. */
const PERIOD_SEC = 24;

export function SpinningPlanet({
  src,
  alt = "",
  className = "",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 모션을 줄여 달라고 한 사용자에게는 돌리지 않는다. 정지 이미지가 그대로 남는다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const img = new Image();
    // ⚠️ crossOrigin 을 지정하지 않는다. getImageData 를 쓰지 않으므로 캔버스가
    //    오염돼도 상관없고, 지정했다가 CORS 헤더가 없으면 로드 자체가 실패한다.
    img.src = src;

    let raf = 0;
    let angle = 0;
    let last = 0;
    let paused = false;
    let visible = true;

    // 커서를 올리면 멈춘다 — "지령을 받는 동안 행성이 정지" 하는 연출.
    // hover 대상은 카드 전체(<a>)라 거기에 붙인다.
    const hoverTarget = canvas.closest("a") ?? canvas.parentElement;
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    hoverTarget?.addEventListener("pointerenter", onEnter);
    hoverTarget?.addEventListener("pointerleave", onLeave);

    // 화면 밖에서는 그리지 않는다.
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, {
      rootMargin: "200px",
    });
    io.observe(canvas);

    /**
     * 캔버스 내부 해상도는 고정한다. 세로줄 하나씩 그리는 방식이라 비용이
     * 가로 픽셀 수에 비례하는데, 행성은 지름 144px 남짓이라 이 정도면 충분하다.
     */
    const RES = 288;
    /** 한 번에 그리는 줄 너비(px). 좁을수록 매끄럽지만 호출 수가 늘어난다. */
    const SLICE = 1;

    canvas.width = RES;
    canvas.height = RES;

    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      if (!last) last = now;
      const dt = (now - last) / 1000;
      last = now;
      if (!paused && visible) angle += (dt / PERIOD_SEC) * Math.PI * 2;
      if (!visible) return;

      const r = RES / 2;
      const sw = img.naturalWidth;
      const sh = img.naturalHeight;

      // 원본에서 실제로 쓸 정사각형. 원반 안쪽만 남기고 테두리는 버린다.
      const side = Math.min(sw, sh) * SAMPLE_SPAN;
      const sx0 = (sw - side) / 2;
      const sy0 = (sh - side) / 2;
      const sWidth = side;
      const sHeight = side;

      ctx!.clearRect(0, 0, RES, RES);

      for (let i = 0; i < RES; i += SLICE) {
        // 화면 가로 위치 → 구면 경도. 정사영에서 x = sin(경도) 이므로 경도는 asin(x).
        const nx = (i + SLICE / 2 - r) / r;
        if (nx <= -1 || nx >= 1) continue;
        const cos = Math.sqrt(1 - nx * nx);
        const lambda = Math.asin(nx) + angle;

        // 경도 → 원본 가로 위치. 한 바퀴(2π)를 원본 왕복(0→1→0)에 대응시킨다.
        // 왕복이라 좌우가 번갈아 뒤집히지만 **이음매가 없다.** 그냥 반복시키면
        // 원본의 왼쪽 끝과 오른쪽 끝이 맞닿아 세로 경계선이 지나간다.
        const phase = (((lambda / (Math.PI * 2)) % 1) + 1) % 1;
        const u = phase < 0.5 ? phase * 2 : 2 - phase * 2;

        // 이 한 줄이 담아야 할 원본 폭.
        //   du/di = 1 / (π · r · cos)  →  가장자리(cos→0)로 갈수록 급격히 넓어진다.
        // **이 넓어짐이 곧 구면 눌림이다.** 가장자리 한 줄에 원본의 넓은 범위가
        // 압축돼 들어가면서 무늬가 납작해지고, 그래야 공이 도는 것으로 읽힌다.
        const span = Math.min((sWidth * SLICE) / (Math.PI * r * cos), sWidth);
        const center = sx0 + u * sWidth;

        ctx!.drawImage(
          img,
          Math.max(sx0, Math.min(sx0 + sWidth - span, center - span / 2)),
          sy0,
          span,
          sHeight,
          i,
          0,
          SLICE,
          RES,
        );
      }
    }

    img.onload = () => {
      setReady(true);
      raf = requestAnimationFrame(draw);
    };

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      hoverTarget?.removeEventListener("pointerenter", onEnter);
      hoverTarget?.removeEventListener("pointerleave", onLeave);
    };
  }, [src]);

  return (
    <>
      {/* 캔버스가 준비되기 전(또는 모션 줄이기)에는 원본 그림이 그대로 보인다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${className} ${ready ? "opacity-0" : ""}`}
        aria-hidden={ready}
      />
      <canvas ref={canvasRef} className={`${className} ${ready ? "" : "opacity-0"}`} aria-hidden />
    </>
  );
}
