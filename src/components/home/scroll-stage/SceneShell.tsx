"use client";

import type { CSSProperties, ReactNode } from "react";
import { clamp01 } from "@/lib/motion";

const SLIDE_DISTANCE_PERCENT = 100;
const HOLD_SCALE = 1.08;

// 스크롤 위치를 그대로 튀듯 따라가지 않고, 살짝 쫓아오며 멈추는 "쫀득한" 느낌을 주기 위한 이징.
const MOTION_DURATION = "0.55s";
const MOTION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function SceneShell({
  local,
  reduceMotion,
  index = 0,
  isFirst = false,
  isLast = false,
  className = "",
  variant = "fade",
  children,
}: {
  local: number;
  reduceMotion: boolean;
  index?: number;
  isFirst?: boolean;
  isLast?: boolean;
  className?: string;
  variant?: "fade" | "rise";
  children: ReactNode;
}) {
  if (reduceMotion) {
    return <section className={`px-6 py-24 ${className}`}>{children}</section>;
  }

  let style: CSSProperties;
  let visibility: number;

  if (variant === "rise") {
    // 5단계, 각 구간 폭은 local 기준(이 씬 전체가 weight prop으로 훨씬 긴 스크롤 구간을 받으므로
    // 절대 스크롤 거리로는 이 비율보다 훨씬 길게 느껴진다):
    // 0~p1 진입(슬라이드 업) → p1~p2 줌인(제자리, 확대) → p2~p3 순수 hold(제자리, 그대로 고정)
    // → p3~p4 줌아웃(제자리, 축소, 줌인과 같은 폭=같은 속도) → p4~1 이탈(슬라이드 업, 진입과 같은 폭=같은 속도)
    // ⚠️ hold(p2~p3)를 짧게 줄였다. 같은 이유 — 멈춰 있는 시간이 길수록
    //    전환이 갑작스럽게 느껴진다(2026-09-14).
    const p1 = 0.2;
    const p2 = 0.34;
    const p3 = 0.62;
    const p4 = 0.8;

    const enterT = isFirst ? 1 : clamp01(local / p1);
    const zoomInT = clamp01((local - p1) / (p2 - p1));
    const zoomOutT = clamp01((local - p3) / (p4 - p3));
    const exitT = isLast ? 0 : clamp01((local - p4) / (1 - p4));

    visibility = enterT * (1 - exitT);
    const scale = 1 + (HOLD_SCALE - 1) * zoomInT * (1 - zoomOutT);
    const translateY = ((1 - enterT) - exitT) * SLIDE_DISTANCE_PERCENT;
    // opacity는 쓰지 않음 — 페이드가 아니라 실제로 아래에서 밀려 올라오는/위로 빠져나가는 모습이 보여야 하므로.
    style = {
      transform: `translateY(${translateY}%) scale(${scale})`,
      pointerEvents: visibility > 0.5 ? "auto" : "none",
      zIndex: index + 1,
      transition: `transform ${MOTION_DURATION} ${MOTION_EASE}`,
    };
  } else {
    // fade: 0~0.4 리빌, 0.4~0.6 hold, 0.6~1 이탈.
    // ⚠️ 예전엔 0.3/0.7 이었다. 가만히 멈춰 있는 구간이 길고 전환은 짧아서
    //    "한참 멈췄다가 갑자기 와르르 넘어간다"고 느껴졌다(2026-09-14 제보).
    //    hold 를 줄이고 전환에 구간을 더 줘서 스크롤을 따라 꾸준히 움직이게 한다.
    const enter = isFirst ? 1 : clamp01(local / 0.4);
    const exit = isLast ? 0 : clamp01((local - 0.6) / 0.4);
    visibility = enter * (1 - exit);
    const clipInset = (1 - enter) * 22 + exit * 22;
    style = {
      opacity: visibility,
      clipPath: `inset(${clipInset}% round 0px)`,
      transform: `scale(${0.94 + visibility * 0.06})`,
      filter: `blur(${(1 - visibility) * 14}px)`,
      pointerEvents: visibility > 0.5 ? "auto" : "none",
      zIndex: index + 1,
      transition: `opacity ${MOTION_DURATION} ${MOTION_EASE}, transform ${MOTION_DURATION} ${MOTION_EASE}, clip-path ${MOTION_DURATION} ${MOTION_EASE}, filter ${MOTION_DURATION} ${MOTION_EASE}`,
    };
  }

  return (
    <div
      aria-hidden={visibility < 0.5}
      className={`absolute inset-0 flex items-center justify-center px-6 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
