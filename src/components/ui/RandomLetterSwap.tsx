"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, type Transition } from "motion/react";
import { useIsTouchDevice } from "@/lib/useIsTouchDevice";

// 마운트 시 한 번만 글자 순서를 섞어서 고정 — 매 렌더마다 다시 섞으면 리렌더될 때
// 애니메이션 순서가 흔들리므로 useMemo로 고정한다.
function shuffledIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export function RandomLetterSwap({
  label,
  className,
  active = true,
  staggerDuration = 0.025,
  transition = { duration: 0.5, type: "spring" },
}: {
  label: string;
  className?: string;
  active?: boolean;
  staggerDuration?: number;
  transition?: Transition;
}) {
  const [hovered, setHovered] = useState(false);
  const isTouchDevice = useIsTouchDevice();
  const letters = useMemo(() => label.split(""), [label]);
  // 왼쪽부터 순서대로 넘어가면 "물결"처럼 보여서 밋밋함 — 대신 글자마다 무작위
  // 순서로 애니메이션이 시작되게 해서 글리치처럼 흐트러지는 느낌을 준다.
  const order = useMemo(() => shuffledIndices(letters.length), [letters.length]);

  // 터치 기기에서 active가 false(실제 다른 메뉴로 네비게이션)로 바뀔 때만 이탈 애니메이션 실행
  useEffect(() => {
    if (isTouchDevice && !active) {
      setHovered(false);
    }
  }, [active, isTouchDevice]);

  return (
    <span
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        // 터치 기기에서는 이탈 이벤트 무시 — useEffect에서만 처리
        if (!isTouchDevice) {
          setHovered(false);
        }
      }}
      style={{ display: "inline-flex" }}
    >
      {letters.map((char, i) => (
        <span key={i} style={{ position: "relative", display: "inline-block", overflow: "hidden" }}>
          {/* 보이지 않는 자리차지용 — 두 겹의 motion.span이 absolute라 부모 너비가 안 잡히는 걸 막음 */}
          <span style={{ visibility: "hidden" }}>{char === " " ? " " : char}</span>
          <motion.span
            style={{ position: "absolute", left: 0, top: 0, display: "inline-block" }}
            animate={{ y: hovered ? "-100%" : "0%", opacity: hovered ? 0 : 1 }}
            transition={{ ...transition, delay: order[i] * staggerDuration }}
          >
            {char === " " ? " " : char}
          </motion.span>
          <motion.span
            style={{ position: "absolute", left: 0, top: 0, display: "inline-block" }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: hovered ? "0%" : "100%", opacity: hovered ? 1 : 0 }}
            transition={{ ...transition, delay: order[i] * staggerDuration }}
          >
            {char === " " ? " " : char}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
