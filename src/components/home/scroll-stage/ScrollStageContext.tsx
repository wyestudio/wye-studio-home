"use client";

import { createContext, useContext } from "react";
import { clamp01 } from "@/lib/motion";

type StageContextValue = {
  progress: number;
  reduceMotion: boolean;
};

export const ScrollStageContext = createContext<StageContextValue>({
  progress: 0,
  reduceMotion: false,
});

// 씬 경계마다 살짝 겹치게 해서 크로스페이드가 되도록 하되, 너무 크면 두 씬의 글자가
// 동시에 선명하게 겹쳐 보여 가독성이 떨어지므로 짧게 잡는다(블러로 나머지를 보완).
const OVERLAP_RATIO = 0.16;

// range: 씬마다 다른(가중치가 반영된) 구간을 쓰고 싶을 때 ScrollStage가 넘겨준다.
// 안 넘어오면 기존처럼 index/total로 균등 분할한 구간을 그대로 쓴다(하위호환).
// unitSpan: weight=1인 "표준 한 씬"의 구간 폭. 겹침(overlap)은 이 값 기준으로 고정 계산해서,
// 어떤 씬이 weight를 크게 받아 hold가 길어져도 다음 씬과의 크로스페이드 폭 자체는 안 늘어나게 한다
// (안 그러면 큰 씬의 넉넉한 여유 구간까지 겹침으로 잡혀서 다음 씬이 너무 일찍 진하게 겹쳐 보인다).
export function useScene(
  index: number,
  total: number,
  range?: { start: number; end: number; unitSpan?: number },
) {
  const { progress, reduceMotion } = useContext(ScrollStageContext);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  if (reduceMotion || total <= 0) {
    return { local: 1, reduceMotion: true, isFirst, isLast };
  }

  const rawStart = range ? range.start : index / total;
  const rawEnd = range ? range.end : (index + 1) / total;
  const overlapBase = range?.unitSpan ?? rawEnd - rawStart;
  const overlap = overlapBase * OVERLAP_RATIO;
  const start = Math.max(0, rawStart - overlap);
  const end = Math.min(1, rawEnd + overlap);
  const local = end > start ? (progress - start) / (end - start) : 0;

  return { local: clamp01(local), reduceMotion: false, isFirst, isLast };
}
