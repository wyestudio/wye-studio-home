"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MASCOTS, MASCOT_ORDER, type MascotId } from "@/lib/mascots";
import { clamp01 } from "@/lib/motion";

const WALK_SPEED = 0.12; // 픽셀/ms, 목표를 향해 걷는 속도
const CONTENT_PADDING_PX = 25; // 콘텐츠 박스 주변 여유 (충돌 판정용)
const ARRIVE_THRESHOLD_PX = 24; // 목표 도착 판정 거리
const MIN_TARGET_DISTANCE_PX = 80; // 현재 위치로부터 목표의 최소 거리
const PAUSE_DURATION_MS = [200, 450]; // 도착 후 대기 시간 범위 [min, max]
const DRIFT_DELAYS = ["0s", "-3s", "-1.5s"];
const FALLBACK_ANGLES_DEG = [-90, 30, 150];

type Vec2 = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

function getMascotRadius(meta: typeof MASCOTS[keyof typeof MASCOTS]): number {
  return Math.sqrt((meta.orbitWidth / 2) ** 2 + (meta.orbitHeight / 2) ** 2);
}

export function MascotFreeRoam({
  progress,
  reduceMotion,
  contentRef,
}: {
  progress: number;
  reduceMotion: boolean;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mascotElRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const posRef = useRef<Vec2[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  // 바운싱 볼: 속도 벡터 (방향과 속도가 모두 들어있음)
  const velocityRef = useRef<Vec2[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  const dragStateRef = useRef<
    Array<{ dragging: boolean; pointerId?: number; grabOffset: Vec2; dragVelocity: Vec2 }>
  >([
    { dragging: false, grabOffset: { x: 0, y: 0 }, dragVelocity: { x: 0, y: 0 } },
    { dragging: false, grabOffset: { x: 0, y: 0 }, dragVelocity: { x: 0, y: 0 } },
    { dragging: false, grabOffset: { x: 0, y: 0 }, dragVelocity: { x: 0, y: 0 } },
  ]);

  const rectRef = useRef({ width: 0, height: 0, left: 0, top: 0 });
  const contentRectRef = useRef<Rect | null>(null);
  const mascotRadiiRef = useRef<number[]>([0, 0, 0]); // 각 마스코트의 반지름
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const speedVarianceRef = useRef([1.0, 0.9, 1.1]); // 마스코트별 개체차
  const targetRef = useRef<(Vec2 | null)[]>([null, null, null]); // 각 마스코트의 목표 좌표
  const pauseUntilRef = useRef<number[]>([0, 0, 0]); // 각 마스코트의 대기 종료 시각 (ms)

  useEffect(() => {
    if (reduceMotion) return;
    const container = containerRef.current;
    if (!container) return;

    // 콘텐츠 박스를 피하면서 랜덤 좌표를 샘플링 (재사용 가능한 헬퍼)
    // measure()보다 먼저 선언되어야 measure() 내에서 호출 가능 (TDZ 방지)
    const sampleAvoidingContent = (radius: number, currentPos?: Vec2): Vec2 => {
      const { width, height } = rectRef.current;
      const maxAttempts = 10;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = radius + Math.random() * (width - radius * 2);
        const y = radius + Math.random() * (height - radius * 2);
        const candidate = { x, y };

        // 콘텐츠 박스(+패딩) 내부 체크
        if (contentRectRef.current) {
          const padded = {
            x: contentRectRef.current.x - CONTENT_PADDING_PX,
            y: contentRectRef.current.y - CONTENT_PADDING_PX,
            width: contentRectRef.current.width + CONTENT_PADDING_PX * 2,
            height: contentRectRef.current.height + CONTENT_PADDING_PX * 2,
          };

          const closestX = Math.max(padded.x, Math.min(candidate.x, padded.x + padded.width));
          const closestY = Math.max(padded.y, Math.min(candidate.y, padded.y + padded.height));
          const dx = candidate.x - closestX;
          const dy = candidate.y - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < radius) continue; // 콘텐츠 박스 안 — 재추첨
        }

        // 현재 위치와의 거리 체크 (제공된 경우만)
        if (currentPos) {
          const dx = candidate.x - currentPos.x;
          const dy = candidate.y - currentPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MIN_TARGET_DISTANCE_PX) continue; // 너무 가까움 — 재추첨
        }

        return candidate; // 조건을 만족한 좌표 반환
      }

      // 재추첨 실패 시 마지막 샘플 사용 (극단적인 경우)
      const x = radius + Math.random() * (width - radius * 2);
      const y = radius + Math.random() * (height - radius * 2);
      return { x, y };
    };

    function measure() {
      const rect = container!.getBoundingClientRect();
      rectRef.current = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };

      // 콘텐츠 렉트 캐싱 (초기 위치 설정보다 먼저)
      if (contentRef?.current) {
        const contentRect = contentRef.current.getBoundingClientRect();
        const containerRect = container!.getBoundingClientRect();
        contentRectRef.current = {
          x: contentRect.left - containerRect.left,
          y: contentRect.top - containerRect.top,
          width: contentRect.width,
          height: contentRect.height,
        };
      }

      // 초기 위치 및 목표 설정 (첫 실행시만, 콘텐츠 렉트 캐싱 후)
      if (posRef.current[0].x === 0 && posRef.current[0].y === 0) {
        // 각 마스코트의 반지름 계산
        MASCOT_ORDER.forEach((id, i) => {
          const meta = MASCOTS[id];
          mascotRadiiRef.current[i] = getMascotRadius(meta);
        });

        // 각 마스코트를 콘텐츠 박스를 피해서 배치
        MASCOT_ORDER.forEach((id, i) => {
          const radius = mascotRadiiRef.current[i];
          posRef.current[i] = sampleAvoidingContent(radius); // 현재 위치 없이 단순 회피 샘플링
        });
      }
    }

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    if (contentRef?.current) resizeObserver.observe(contentRef.current);

    const pickTargetFn = (i: number) => {
      const radius = mascotRadiiRef.current[i];

      // 콘텐츠 박스를 피하면서 현재 위치로부터 적절히 떨어진 좌표 샘플링
      const candidate = sampleAvoidingContent(radius, posRef.current[i]);

      targetRef.current[i] = candidate;
      const dx = candidate.x - posRef.current[i].x;
      const dy = candidate.y - posRef.current[i].y;
      const targetDist = Math.sqrt(dx * dx + dy * dy);
      const speed = WALK_SPEED * speedVarianceRef.current[i];
      velocityRef.current[i] = {
        x: (dx / targetDist) * speed,
        y: (dy / targetDist) * speed,
      };
      pauseUntilRef.current[i] = 0; // 대기 시간 초기화
    };

    // 원-사각형 충돌 감지, 반사, 위치 보정 (벽/마스코트 충돌과 일관성)
    function reflectOffRect(i: number, pos: Vec2, velocity: Vec2, radius: number, rect: Rect): Vec2 {
      const padded = {
        x: rect.x - CONTENT_PADDING_PX,
        y: rect.y - CONTENT_PADDING_PX,
        width: rect.width + CONTENT_PADDING_PX * 2,
        height: rect.height + CONTENT_PADDING_PX * 2,
      };

      // 가장 가까운 점 찾기
      const closestX = Math.max(padded.x, Math.min(pos.x, padded.x + padded.width));
      const closestY = Math.max(padded.y, Math.min(pos.y, padded.y + padded.height));
      const dx = pos.x - closestX;
      const dy = pos.y - closestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 충돌 감지
      if (dist < radius) {
        // 반사 속도 계산
        let reflectedVelocity: Vec2;

        if (dist > 0) {
          // 일반적인 경우: 중심이 사각형 바깥에 있음
          const penetrationX = radius - Math.abs(dx);
          const penetrationY = radius - Math.abs(dy);

          if (penetrationX < penetrationY) {
            // x축 반사
            reflectedVelocity = { x: -velocity.x, y: velocity.y };
          } else {
            // y축 반사
            reflectedVelocity = { x: velocity.x, y: -velocity.y };
          }

          // 위치 보정: 법선 방향으로 밀어내 사각형 경계에 접하게 함
          const nx = dx / dist;
          const ny = dy / dist;
          posRef.current[i].x = closestX + nx * radius;
          posRef.current[i].y = closestY + ny * radius;
        } else {
          // 예외 케이스: 중심이 사각형 내부에 있음 (스폰 직후 등)
          // 사각형의 네 변 중 가장 가까운 변 쪽으로 밀어냄

          const leftDist = pos.x - padded.x;
          const rightDist = padded.x + padded.width - pos.x;
          const topDist = pos.y - padded.y;
          const bottomDist = padded.y + padded.height - pos.y;

          const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

          // 가장 가까운 변의 법선 방향으로 결정
          if (minDist === leftDist) {
            // 좌측 변: 왼쪽으로 밀어냄
            posRef.current[i].x = padded.x - radius;
            reflectedVelocity = { x: -Math.abs(velocity.x), y: velocity.y };
          } else if (minDist === rightDist) {
            // 우측 변: 오른쪽으로 밀어냄
            posRef.current[i].x = padded.x + padded.width + radius;
            reflectedVelocity = { x: Math.abs(velocity.x), y: velocity.y };
          } else if (minDist === topDist) {
            // 상측 변: 위로 밀어냄
            posRef.current[i].y = padded.y - radius;
            reflectedVelocity = { x: velocity.x, y: -Math.abs(velocity.y) };
          } else {
            // 하측 변: 아래로 밀어냄
            posRef.current[i].y = padded.y + padded.height + radius;
            reflectedVelocity = { x: velocity.x, y: Math.abs(velocity.y) };
          }
        }

        return reflectedVelocity;
      }

      return velocity;
    }

    // 원-원 충돌 감지 및 반사
    function reflectBetweenMascots(i: number, j: number): boolean {
      const r1 = mascotRadiiRef.current[i];
      const r2 = mascotRadiiRef.current[j];
      const dx = posRef.current[j].x - posRef.current[i].x;
      const dy = posRef.current[j].y - posRef.current[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < r1 + r2 && dist > 0) {
        // 법선 방향
        const nx = dx / dist;
        const ny = dy / dist;

        // 속도의 법선 성분 추출
        const v1n = velocityRef.current[i].x * nx + velocityRef.current[i].y * ny;
        const v2n = velocityRef.current[j].x * nx + velocityRef.current[j].y * ny;

        // 서로 가까워지고 있으면 반사
        if (v1n > v2n) {
          // 반사
          velocityRef.current[i].x -= v1n * nx;
          velocityRef.current[i].y -= v1n * ny;
          velocityRef.current[j].x -= v2n * nx;
          velocityRef.current[j].y -= v2n * ny;

          // 겹친 만큼 밀어내기
          const overlap = (r1 + r2 - dist) / 2 + 1;
          posRef.current[i].x -= nx * overlap;
          posRef.current[i].y -= ny * overlap;
          posRef.current[j].x += nx * overlap;
          posRef.current[j].y += ny * overlap;

          return true; // 충돌 발생
        }
      }

      return false; // 충돌 없음
    }

    function tick(time: number) {
      const lastTime = lastTimeRef.current;
      const dt = lastTime === null ? 16 : Math.min(time - lastTime, 48);
      lastTimeRef.current = time;

      const { width, height } = rectRef.current;
      if (width === 0 || height === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // === Pass 1: 각 마스코트의 독립적 이동 처리 (목표, 벽, 콘텐츠 충돌) ===
      MASCOT_ORDER.forEach((id, i) => {
        const dragState = dragStateRef.current[i];
        const meta = MASCOTS[id];
        const radius = mascotRadiiRef.current[i];

        if (dragState.dragging) {
          // 드래그 중: 위치는 포인터 콜백에서 업데이트됨
        } else {
          // 1. 목표 설정 (필요하면)
          if (!targetRef.current[i] && time >= pauseUntilRef.current[i]) {
            pickTargetFn(i);
          }

          // 2. 대기 중이면 속도를 0으로
          if (time < pauseUntilRef.current[i]) {
            velocityRef.current[i] = { x: 0, y: 0 };
          }

          // 3. 직선 이동
          posRef.current[i].x += velocityRef.current[i].x * dt;
          posRef.current[i].y += velocityRef.current[i].y * dt;

          // 4. 컨테이너 경계 충돌
          let hitBoundary = false;
          if (posRef.current[i].x - radius < 0) {
            posRef.current[i].x = radius;
            velocityRef.current[i].x *= -1;
            hitBoundary = true;
          } else if (posRef.current[i].x + radius > width) {
            posRef.current[i].x = width - radius;
            velocityRef.current[i].x *= -1;
            hitBoundary = true;
          }

          if (posRef.current[i].y - radius < 0) {
            posRef.current[i].y = radius;
            velocityRef.current[i].y *= -1;
            hitBoundary = true;
          } else if (posRef.current[i].y + radius > height) {
            posRef.current[i].y = height - radius;
            velocityRef.current[i].y *= -1;
            hitBoundary = true;
          }

          // 5. 콘텐츠 박스 충돌
          let hitContent = false;
          if (contentRectRef.current) {
            const newVelocity = reflectOffRect(
              i,
              posRef.current[i],
              velocityRef.current[i],
              radius,
              contentRectRef.current
            );
            if (newVelocity !== velocityRef.current[i]) {
              velocityRef.current[i] = newVelocity;
              hitContent = true;
            }
          }

          // 6. 충돌 처리 후 목표 갱신
          if (hitBoundary || hitContent) {
            targetRef.current[i] = null; // 다음 프레임에 새 목표 선택
          } else if (targetRef.current[i]) {
            // 7. 목표 도착 판정
            const dx = targetRef.current[i].x - posRef.current[i].x;
            const dy = targetRef.current[i].y - posRef.current[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < ARRIVE_THRESHOLD_PX) {
              // 도착: 대기 설정 후 목표 비우기
              targetRef.current[i] = null;
              const pauseDuration = PAUSE_DURATION_MS[0] + Math.random() * (PAUSE_DURATION_MS[1] - PAUSE_DURATION_MS[0]);
              pauseUntilRef.current[i] = time + pauseDuration;
            }
          }
        }
      });

      // === Pass 2: 마스코트끼리의 충돌 검사 (Pass 1이 모든 마스코트에 대해 끝난 후) ===
      // 모든 쌍(i, j) i < j에 대해 충돌 검사
      for (let i = 0; i < MASCOT_ORDER.length; i++) {
        for (let j = i + 1; j < MASCOT_ORDER.length; j++) {
          const collided = reflectBetweenMascots(i, j);
          if (collided) {
            // 충돌한 마스코트는 target을 비우고, 다음 프레임(Pass 1)에서 새로운 목표를 선택하도록 함
            targetRef.current[i] = null;
            targetRef.current[j] = null;
            pauseUntilRef.current[i] = 0;
            pauseUntilRef.current[j] = 0;
          }
        }
      }

      // === Pass 3: 최종 위치를 DOM에 렌더링 ===
      MASCOT_ORDER.forEach((id, i) => {
        const meta = MASCOTS[id];
        const el = mascotElRefs.current[i];
        if (el) {
          const halfW = meta.orbitWidth / 2;
          const halfH = meta.orbitHeight / 2;
          el.style.transform = `translate3d(${posRef.current[i].x - halfW}px, ${posRef.current[i].y - halfH}px, 0)`;
        }
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion, contentRef]);

  // 포인터 이벤트 핸들러
  const handlePointerDown = (i: number, e: React.PointerEvent<HTMLDivElement>) => {
    const el = mascotElRefs.current[i];
    if (!el) return;

    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setDraggingIndex(i);
    dragStateRef.current[i] = {
      dragging: true,
      pointerId: e.pointerId,
      grabOffset: {
        x: e.clientX - containerRect.left - (rect.left - containerRect.left),
        y: e.clientY - containerRect.top - (rect.top - containerRect.top),
      },
      dragVelocity: { x: 0, y: 0 },
    };
  };

  const handlePointerMove = (i: number, e: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current[i];
    if (!dragState.dragging) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const newX = e.clientX - containerRect.left - dragState.grabOffset.x;
    const newY = e.clientY - containerRect.top - dragState.grabOffset.y;
    const oldPos = posRef.current[i];
    const deltaX = newX - oldPos.x;
    const deltaY = newY - oldPos.y;

    posRef.current[i] = { x: newX, y: newY };
    dragState.dragVelocity = { x: deltaX, y: deltaY };
  };

  const handlePointerUp = (i: number, e: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current[i];
    if (!dragState.dragging) return;

    const el = mascotElRefs.current[i];
    if (el) el.releasePointerCapture(e.pointerId);

    setDraggingIndex(null);

    const dist = Math.sqrt(dragState.dragVelocity.x ** 2 + dragState.dragVelocity.y ** 2);
    const { width, height } = rectRef.current;
    const radius = mascotRadiiRef.current[i];

    if (dist > 6) {
      // 던진 경우: 던진 방향의 먼 지점을 목표로 설정
      const throwAngle = Math.atan2(dragState.dragVelocity.y, dragState.dragVelocity.x);
      const speed = WALK_SPEED * speedVarianceRef.current[i];

      // 던진 방향으로 투영한 먼 지점을 컨테이너 범위 안으로 클램프
      const projectionDist = 400; // 던진 방향으로 충분히 먼 거리
      const targetX = Math.max(radius, Math.min(posRef.current[i].x + Math.cos(throwAngle) * projectionDist, width - radius));
      const targetY = Math.max(radius, Math.min(posRef.current[i].y + Math.sin(throwAngle) * projectionDist, height - radius));

      targetRef.current[i] = { x: targetX, y: targetY };
      velocityRef.current[i] = {
        x: Math.cos(throwAngle) * speed,
        y: Math.sin(throwAngle) * speed,
      };
      pauseUntilRef.current[i] = 0; // 던진 후 대기 없음
    } else {
      // 순수 탭: 새 목표를 바로 선택
      // pickTargetFn은 useEffect 스코프 내에서만 접근 가능하므로 여기서는 직접 구현
      targetRef.current[i] = null; // 다음 프레임에서 자동으로 새 목표가 선택됨
      pauseUntilRef.current[i] = 0;
    }

    dragStateRef.current[i] = {
      dragging: false,
      grabOffset: { x: 0, y: 0 },
      dragVelocity: { x: 0, y: 0 },
    };
  };

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
              className="absolute"
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
            >
              <Image
                src={meta.orbitSrc}
                alt={meta.alt}
                width={meta.orbitWidth}
                height={meta.orbitHeight}
                priority
                className="drop-shadow-[0_0_30px_var(--glow)]"
              />
            </div>
          );
        })}
      </div>
    );
  }

  const fadeOpacity = clamp01(1 - progress);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0" style={{ opacity: fadeOpacity }}>
        {MASCOT_ORDER.map((id, i) => {
          const meta = MASCOTS[id];
          return (
            <div
              key={id}
              ref={(el) => {
                mascotElRefs.current[i] = el;
              }}
              className="group absolute left-0 top-0 pointer-events-auto cursor-grab active:cursor-grabbing"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerMove={(e) => handlePointerMove(i, e)}
              onPointerUp={(e) => handlePointerUp(i, e)}
              onPointerCancel={(e) => handlePointerUp(i, e)}
            >
              <div className="animate-drift flex flex-col items-center gap-1" style={{ animationDelay: DRIFT_DELAYS[i] }}>
                <span
                  className="pointer-events-none rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-foreground backdrop-blur-sm transition-opacity duration-150"
                  style={{ opacity: draggingIndex === i ? 1 : 0 }}
                >
                  {meta.name}
                </span>
                <Image
                  src={meta.orbitSrc}
                  alt={meta.alt}
                  width={meta.orbitWidth}
                  height={meta.orbitHeight}
                  priority
                  className="drop-shadow-[0_0_30px_var(--glow)] select-none"
                  draggable={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
