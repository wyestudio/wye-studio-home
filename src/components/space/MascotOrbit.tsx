"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MASCOT_ORDER, mascotsForSkin, type MascotId, type MascotMeta, mascotGlow } from "@/lib/mascots";
import { useSiteSkin } from "@/components/season/SeasonContext";
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
/**
 * 궤도를 눕힌다 — 위에서 내려다본 원이 아니라 비스듬히 본 타원. 세로 반지름이 가로의 이만큼.
 * 뒤쪽(위)을 지날 때는 작고 어둡게 로고 뒤로, 앞쪽(아래)을 지날 때는 크고 밝게 로고 앞으로 간다.
 * 홈 행성계(home/space/spaceScene.ts)의 위성 궤도와 같은 생각이다.
 */
const ORBIT_TILT = 0.5;
/** 타원을 살짝 돌려 둔다(라디안) — 수평이면 납작한 띠처럼 보인다 */
const ORBIT_ROT = -0.17;
/** 마우스 시차 — 마스코트 겹이 움직이는 최대 폭(px). 로고(작게)와 별(크게) 사이 */
const PARALLAX_PX = 14;

// 마스코트 절반 대각선 길이 계산
/** 돌린 타원의 뒤 반(위 · sin<0) 또는 앞 반(아래)을 SVG 경로로 */
function ellipseHalf(cx: number, cy: number, rx: number, ry: number, rot: number, half: "back" | "front") {
  const pts: string[] = [];
  const from = half === "back" ? Math.PI : 0;
  for (let i = 0; i <= 48; i++) {
    const a = from + (Math.PI * i) / 48;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push(`${(cx + x * Math.cos(rot) - y * Math.sin(rot)).toFixed(1)},${(cy + x * Math.sin(rot) + y * Math.cos(rot)).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}

function getMascotHalfDiagonal(meta: MascotMeta): number {
  return Math.sqrt((meta.orbitWidth / 2) ** 2 + (meta.orbitHeight / 2) ** 2);
}

type Vec2 = { x: number; y: number };

export function MascotOrbit({
  progress,
  reduceMotion,
  minRadius = 0,
  pointer,
}: {
  progress: number;
  reduceMotion: boolean;
  minRadius?: number;
  /** 마우스 위치(-1~1). HeroScene 이 부드럽게 따라가게 해서 넘긴다 */
  pointer?: React.RefObject<{ x: number; y: number }>;
}) {
  const { selectMascot } = useMascotSelection();
  // 시즌 스킨이면 할로윈 그림(크기도 다르다). 아래 MASCOTS 는 전부 이걸 가리킨다.
  const MASCOTS = mascotsForSkin(useSiteSkin());
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
  // 히어로가 다 사라진 뒤(progress ≥ 1)에는 위치 · 밝기 계산을 건너뛴다 — 히어로는 투명해질 뿐
  // 자리에 남아 있어서, 그냥 두면 다음 장면을 보는 동안에도 매 프레임 보이지 않는 마스코트를 옮긴다.
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [ringRadius, setRingRadius] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ringRefs = useRef<(SVGSVGElement | null)[]>([null, null]);
  const mascotElsRef = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  // minRadius가 바뀔 때마다 반지름 재계산 (별도 useEffect)
  useEffect(() => {
    minRadiusRef.current = minRadius;

    const { width, height } = rectRef.current;
    if (width > 0 && height > 0) {
      const maxMascotDiagonal = Math.max(...MASCOT_ORDER.map((id) => getMascotHalfDiagonal(MASCOTS[id])));
      const minDesiredRadius = minRadius + maxMascotDiagonal + MASCOT_CLEARANCE_PX;
      const edgeSafe = Math.min(minDesiredRadius, width / 2 - EDGE_MARGIN_PX, (height / 2 - EDGE_MARGIN_PX) / ORBIT_TILT);
      const newRadius = Math.max(RADIUS_FLOOR_PX, edgeSafe);
      radiusRef.current = newRadius;
      setRingRadius(newRadius);
    }
  }, [minRadius, MASCOTS]);

  useEffect(() => {
    if (reduceMotion) return;
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const rect = container!.getBoundingClientRect();
      rectRef.current = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
      setBox({ w: rect.width, h: rect.height });

      // 첫 측정 후 반지름 계산
      const { width, height } = rect;
      if (width > 0 && height > 0) {
        const maxMascotDiagonal = Math.max(...MASCOT_ORDER.map((id) => getMascotHalfDiagonal(MASCOTS[id])));
        const minDesiredRadius = minRadiusRef.current + maxMascotDiagonal + MASCOT_CLEARANCE_PX;
        const edgeSafe = Math.min(minDesiredRadius, width / 2 - EDGE_MARGIN_PX, (height / 2 - EDGE_MARGIN_PX) / ORBIT_TILT);
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
      if (progressRef.current >= 1) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
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
      const p = pointer?.current ?? { x: 0, y: 0 };
      const sx = p.x * PARALLAX_PX;
      const sy = p.y * PARALLAX_PX;
      for (const ring of ringRefs.current) {
        if (ring) ring.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      }

      MASCOT_ORDER.forEach((id, i) => {
        const meta = MASCOTS[id];
        anglesRef.current[i] += delta;
        const angle = anglesRef.current[i];
        // 눕힌 타원 위의 점 → 살짝 돌린다. depth: -1(뒤) ~ 1(앞)
        const ox = Math.cos(angle) * radius;
        const oy = Math.sin(angle) * radius * ORBIT_TILT;
        const depth = Math.sin(angle);
        const localX = ox * Math.cos(ORBIT_ROT) - oy * Math.sin(ORBIT_ROT) + sx;
        const localY = ox * Math.sin(ORBIT_ROT) + oy * Math.cos(ORBIT_ROT) + sy;

        lastPosRef.current[i] = { x: centerViewportX + localX, y: centerViewportY + localY };

        const el = mascotElRefs.current[i];
        if (el) {
          const halfW = meta.orbitWidth / 2;
          const halfH = meta.orbitHeight / 2;
          const scale = 1 + depth * 0.18;
          el.style.transform = `translate3d(${width / 2 + localX - halfW}px, ${height / 2 + localY - halfH}px, 0) scale(${scale})`;
          // 뒤쪽은 로고 · 문구(z-10) 뒤로, 앞쪽은 앞으로
          el.style.zIndex = depth > 0 ? "20" : "1";
          el.style.filter = `brightness(${0.62 + 0.38 * ((depth + 1) / 2)})`;
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
  }, [reduceMotion, hasHover, MASCOTS, pointer]);

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
                style={{ filter: mascotGlow(meta.id, 30) }}
              />
              <span
                className={`pointer-events-none rounded-md bg-black/40 px-1.5 py-0.5 text-micro text-foreground backdrop-blur-sm transition-opacity duration-150 ${
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
        {/*
          궤도선 — 눕힌 타원을 뒤 반(위)과 앞 반(아래)으로 나눠 그린다. 뒤 반은 로고 · 문구 뒤에,
          앞 반은 앞에 둬야 마스코트가 실제로 로고 둘레를 도는 것처럼 보인다.
          시즌 스킨이 --orbit-ring 을 금빛으로 바꾼다(season.css). 평소엔 원래 색.
        */}
        {ringRadius > 0 && box.w > 0 &&
          (["back", "front"] as const).map((half, k) => (
            <svg
              key={half}
              ref={(el) => {
                ringRefs.current[k] = el;
              }}
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ zIndex: half === "front" ? 20 : 1 }}
              viewBox={`0 0 ${box.w} ${box.h}`}
            >
              <path
                d={ellipseHalf(box.w / 2, box.h / 2, ringRadius, ringRadius * ORBIT_TILT, ORBIT_ROT, half)}
                fill="none"
                stroke="var(--orbit-ring, rgba(148, 163, 255, 0.25))"
                strokeWidth={1}
                opacity={half === "back" ? 0.55 : 1}
              />
            </svg>
          ))}
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
                  style={{ filter: mascotGlow(meta.id, 30) }}
                />
                <span
                  className={`pointer-events-none rounded-md bg-black/40 px-1.5 py-0.5 text-micro text-foreground backdrop-blur-sm transition-opacity duration-150 ${
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
