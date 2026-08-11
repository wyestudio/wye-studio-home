"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useScrollStageProgress } from "@/components/space/useScrollStageProgress";
import { ScrollStageContext } from "./ScrollStageContext";

// 씬 하나당 기본 스크롤 여유(vh, weight=1 기준) — 씬 사이 전환이 급하지 않게 충분한 스크롤 거리를 준다.
const VH_PER_SCENE = 140;

type SceneCloneProps = {
  index?: number;
  total?: number;
  range?: { start: number; end: number; unitSpan: number };
};

export function ScrollStage({ children }: { children: ReactNode }) {
  const childArray = Children.toArray(children);
  const sceneCount = childArray.length;
  // 씬마다 weight prop으로 다른 스크롤 구간을 가질 수 있다(기본 1 = 다른 씬과 동일한 140vh).
  const weights = childArray.map((child) =>
    isValidElement(child) ? ((child.props as { weight?: number }).weight ?? 1) : 1,
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || sceneCount || 1;
  const { stageRef, progress, reduceMotion } = useScrollStageProgress();

  if (reduceMotion) {
    return (
      <ScrollStageContext.Provider value={{ progress, reduceMotion }}>
        <div className="flex flex-col">{children}</div>
      </ScrollStageContext.Provider>
    );
  }

  // 각 씬의 [start, end] 구간(0~1)을 weight 누적으로 미리 계산 — JSX map 콜백 안에서는
  // 값을 재할당하지 않고 이 배열을 읽기만 한다.
  // unitSpan(weight=1 기준 폭)도 같이 넘겨서, 씬마다 겹침 폭이 자기 weight에 휘둘리지 않게 한다.
  const unitSpan = 1 / totalWeight;
  const ranges: { start: number; end: number; unitSpan: number }[] = [];
  for (let i = 0, acc = 0; i < weights.length; i++) {
    const start = acc;
    acc += weights[i];
    ranges.push({ start: start / totalWeight, end: acc / totalWeight, unitSpan });
  }

  return (
    <div
      ref={stageRef}
      className="relative"
      style={{
        height: `${totalWeight * VH_PER_SCENE}vh`,
        // 헤더가 문서 흐름에서 실제 공간을 차지하는 sticky 요소라, 이 씬 스테이지의
        // sticky 뷰포트는 원래 "헤더 높이만큼 먼저 스크롤해야" 고정되기 시작한다.
        // 그 빈 스크롤 구간을 없애서 첫 스크롤부터 바로 고정+페이드가 시작되도록
        // 헤더 높이만큼 끌어올린다(Header.tsx가 --header-height로 실측값을 넣어줌).
        marginTop: "calc(-1 * var(--header-height, 80px))",
      }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <ScrollStageContext.Provider value={{ progress, reduceMotion }}>
          {childArray.map((child, index) =>
            isValidElement(child)
              ? cloneElement(child as ReactElement<SceneCloneProps>, {
                  index,
                  total: sceneCount,
                  range: ranges[index],
                })
              : child,
          )}
        </ScrollStageContext.Provider>
      </div>
    </div>
  );
}
