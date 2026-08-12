"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MASCOTS, MASCOT_ORDER, type MascotId } from "@/lib/mascots";
import { useMascotSelection } from "@/components/space/MascotSelectionContext";
import { clamp01 } from "@/lib/motion";
import { useHasHover } from "@/lib/useHasHover";

const MIN_SPEED = 0.008;
const EASE_TAU_MS = 140;
const REVOLUTION_MS = 42000;
const BASE_ANGULAR_VELOCITY = (Math.PI * 2) / REVOLUTION_MS;
const DRIFT_DELAYS = ["0s", "-3s", "-1.5s"];
const FALLBACK_ANGLES_DEG = [-90, 30, 150];
const EDGE_MARGIN_PX = 70;
const RADIUS_FLOOR_PX = 80;
const MASCOT_CLEARANCE_PX = 30;

// 마스코트 절반 대각선 길이 계산
function getMascotHalfDiagonal(id: MascotId): number {
  const meta = MASCOTS[id];
  return Math.sqrt((meta.orbitWidth / 2) ** 2 + (meta.orbitHeight / 2) ** 2);
}

type Vec2 = { x: number; y: number };

export function MascotOrbit({ progress, reduceMotion, minRadius = 0 }: { progress: number; reduceMotion: boolean; minRadius?: number }) {
  const { selectMascot } = useMascotSelection();
  const hasHover = useHasHover();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mascotElRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const anglesRef = useRef<number[]>([0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]);
  const speedRef = useRef(1);
  const lastPosRef = useRef<Vec2[]>([
    { x: -9999, y: -9999 },
    { x: -9999, y: -9999 },
    { x: -9999, y: -9999 },
  ]);
  const cursorRef = useRef<Vec2>({ x: -9999, y: -9999 });
  const rectRef = useRef({ width: 0, height: 0, left: 0, top: 0 });
  const radiusRef = useRef(0);
  const minRadiusRef = useRef(minRadius);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [ringRadius, setRingRadius] = useState(0);
  const mascotElsRef = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  // minRadius가 바뀔 때마다 반지름 재계산 (별도 useEffect)
  useEffect(() => {
    minRadiusRef.current = minRadius;

    const { width, height } = rectRef.current;
    if (width > 0 && height > 0) {
      const maxMascotDiagonal = Math.max(...MASCOT_ORDER.map(getMascotHalfDiagonal));
      const minDesiredRadius = minRadius + maxMascotDiagonal + MASCOT_CLEARANCE_PX;
      const edgeSafe = Math.min(minDesiredRadius, width / 2 - EDGE_MARGIN_PX, height / 2 - EDGE_MARGIN_PX);
      const newRadius = Math.max(RADIUS_FLOOR_PX, edgeSafe);
      radiusRef.current = newRadius;
      setRingRadius(newRadius);
    }
  }, [minRadius]);

  useEffect(() => {
    if (reduceMotion) return;
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const rect = container!.getBoundingClientRect();
      rectRef.current = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };

      // 첫 측정 후 반지름 계산
      const { width, height } = rect;
      if (width > 0 && height > 0) {
        const maxMascotDiagonal = Math.max(...MASCOT_ORDER.map(getMascotHalfDiagonal));
        const minDesiredRadius = minRadiusRef.current + maxMascotDiagonal + MASCOT_CLEARANCE_PX;
        const edgeSafe = Math.min(minDesiredRadius, width / 2 - EDGE_MARGIN_PX, height / 2 - EDGE_MARGIN_PX);
        const newRadius = Math.max(RADIUS_FLOOR_PX, edgeSafe);
        radiusRef.current = newRadius;
        setRingRadius(newRadius);
      }
    }
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);

    function handlePointerMove(e: PointerEvent) {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("pointermove", handlePointerMove);

    // 터치 기기에서의 클릭-아웃사이드 처리
    function handleDocumentPointerDown(e: PointerEvent) {
      if (hasHover) return; // 데스크톱은 무시

      const target = e.target as HTMLElement;
      const isClickedOnMascot = mascotElsRef.current.some((el) => el && el.contains(target));

      if (!isClickedOnMascot) {
        setActiveIndex(null);
      }
    }
    document.addEventListener("pointerdown", handleDocumentPointerDown);

    function tick(time: number) {
      const lastTime = lastTimeRef.current;
      const dt = lastTime === null ? 16 : Math.min(time - lastTime, 48);
      lastTimeRef.current = time;

      const { width, height, left, top } = rectRef.current;
      const radius = radiusRef.current;
      const centerViewportX = left + width / 2;
      const centerViewportY = top + height / 2;

      // 커서와의 거리로 속도 조절 (0~400px 범위)
      let minDist = Infinity;
      for (const lastPos of lastPosRef.current) {
        const dx = cursorRef.current.x - lastPos.x;
        const dy = cursorRef.current.y - lastPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) minDist = dist;
      }
      const t = clamp01((minDist - 80) / (400 - 80));
      const targetSpeed = MIN_SPEED + (1 - MIN_SPEED) * t;
      const ease = 1 - Math.exp(-dt / EASE_TAU_MS);
      speedRef.current += (targetSpeed - speedRef.current) * ease;

      const delta = BASE_ANGULAR_VELOCITY * speedRef.current * dt;

      MASCOT_ORDER.forEach((id, i) => {
        const meta = MASCOTS[id];
        anglesRef.current[i] += delta;
        const angle = anglesRef.current[i];
        const localX = Math.cos(angle) * radius;
        const localY = Math.sin(angle) * radius;

        lastPosRef.current[i] = { x: centerViewportX + localX, y: centerViewportY + localY };

        const el = mascotElRefs.current[i];
        if (el) {
          const halfW = meta.orbitWidth / 2;
          const halfH = meta.orbitHeight / 2;
          el.style.transform = `translate3d(${width / 2 + localX - halfW}px, ${height / 2 + localY - halfH}px, 0)`;
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion, hasHover]);

  function handleSelect(idx: number, id: MascotId) {
    if (hasHover) {
      // 데스크톱: 선택 커서
      selectMascot(id);
    } else {
      // 태블릿: 토글
      setActiveIndex((prev) => (prev === idx ? null : idx));
    }
  }

  if (reduceMotion) {
    return (
      <div className="pointer-events-none absolute inset-0">
        {MASCOT_ORDER.map((id, i) => {
          const meta = MASCOTS[id];
          const angle = (FALLBACK_ANGLES_DEG[i] * Math.PI) / 180;
          const left = 50 + Math.cos(angle) * 32;
          const top = 50 + Math.sin(angle) * 32;
          return (
            <div
              key={id}
              ref={(el) => {
                mascotElsRef.current[i] = el;
              }}
              className="group absolute flex flex-col items-center gap-1 pointer-events-auto"
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
              onClick={() => handleSelect(i, id)}
              role="button"
              tabIndex={0}
              aria-label={`${meta.name} 마스코트를 커서로 선택`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(i, id);
                }
              }}
            >
              <Image
                src={meta.orbitSrc}
                alt={meta.alt}
                width={meta.orbitWidth}
                height={meta.orbitHeight}
                priority
                className="drop-shadow-[0_0_30px_var(--glow)]"
              />
              <span
                className={`pointer-events-none rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-foreground backdrop-blur-sm transition-opacity duration-150 ${
                  hasHover || activeIndex === i ? "opacity-100" : "opacity-0"
                } ${hasHover && "group-hover:opacity-100 group-focus-visible:opacity-100"}`}
              >
                {meta.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 로고/텍스트(SceneShell의 exit)와 정확히 같은 속도로 같이 페이드아웃되도록 선형으로.
  const fadeOpacity = clamp01(1 - progress);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0" style={{ opacity: fadeOpacity }}>
        {ringRadius > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: ringRadius * 2,
              height: ringRadius * 2,
              transform: "translate(-50%, -50%)",
              border: "1px solid rgba(148, 163, 255, 0.25)",
            }}
          />
        )}
        {MASCOT_ORDER.map((id, i) => {
          const meta = MASCOTS[id];
          return (
            <div
              key={id}
              ref={(el) => {
                mascotElRefs.current[i] = el;
                mascotElsRef.current[i] = el;
              }}
              className="group absolute left-0 top-0 pointer-events-auto"
              onClick={() => handleSelect(i, id)}
              role="button"
              tabIndex={0}
              aria-label={`${meta.name} 마스코트를 커서로 선택`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(i, id);
                }
              }}
            >
              <div className="animate-drift flex flex-col items-center gap-1" style={{ animationDelay: DRIFT_DELAYS[i] }}>
                <Image
                  src={meta.orbitSrc}
                  alt={meta.alt}
                  width={meta.orbitWidth}
                  height={meta.orbitHeight}
                  priority
                  className="drop-shadow-[0_0_30px_var(--glow)]"
                />
                <span
                  className={`pointer-events-none rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-foreground backdrop-blur-sm transition-opacity duration-150 ${
                    hasHover || activeIndex === i ? "opacity-100" : "opacity-0"
                  } ${hasHover && "group-hover:opacity-100 group-focus-visible:opacity-100"}`}
                >
                  {meta.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
