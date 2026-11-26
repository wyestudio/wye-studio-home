"use client";

import { useEffect, useRef } from "react";
import { mountXmasScene } from "@/components/season/xmas/xmasSceneEngine";
import { useMascotSelection } from "@/components/space/MascotSelectionContext";

/**
 * 크리스마스 배경 — 눈 내리는 밤의 언덕 마을(2026-11-27 최종 시안).
 * 뒤에서 앞으로: 하늘 → 사이트의 별빛 → 달 · 이스의 썰매 → 눈 언덕 세 겹과 마을 · 트리 · 가로등 → 사이트 콘텐츠 →
 * 눈덩이 굴리기(콘텐츠보다 위 — 눌려야 한다).
 *
 * 여기는 빈 칸 셋만 둔다. 안은 xmas/xmasSceneEngine.ts 가 화면 크기에 맞춰 직접 채운다 — 자리가 전부 화면 크기에서
 * 계산되고(서버는 모른다) 눈덩이 · 썰매는 프레임마다 움직여서, React 가 그리면 초당 60번 다시 그리게 된다.
 *   xmas-sc-sky    하늘(season.css). 별빛 캔버스보다 뒤
 *   xmas-sc        뒤 겹 — 콘텐츠 뒤에 깔리고 클릭을 받지 않는다
 *   xmas-sc-front  앞 겹 — 눈덩이와 캐릭터 손잡이만 눌린다. 나머지는 통과시킨다
 *
 * 홈에서는 시안 그대로이고, 홈 밖에서는 낮추고 연하게 눌러 좌우 끝에만 둔다(엔진의 page 모습).
 * 홈의 캐릭터(우쥬 · 케이프 · 이스)를 끌지 않고 누르면 그 캐릭터가 커서 캐릭터가 된다 — 궤도를 돌던 때와 같다.
 */
export function ChristmasBackdrop({ isHome }: { isHome: boolean }) {
  const back = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  // 고르기 함수는 그릴 때마다 새로 만들어진다 — 장면을 그때마다 다시 올리지 않게 ref 로 넘긴다
  const { selectMascot } = useMascotSelection();
  const select = useRef(selectMascot);
  useEffect(() => {
    select.current = selectMascot;
  });

  useEffect(() => {
    if (!back.current || !front.current) return;
    return mountXmasScene(back.current, front.current, {
      mode: isHome ? "home" : "page",
      reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onSelect: (id) => select.current(id),
    });
  }, [isHome]);

  const mode = isHome ? "xmas-sc--home" : "xmas-sc--page";
  return (
    <>
      <div aria-hidden className="season-only xmas-sc-sky" />
      <div ref={back} aria-hidden className={`season-only season-backdrop xmas-sc ${mode}`} />
      <div ref={front} aria-hidden className={`season-only xmas-sc-front ${mode}`} />
    </>
  );
}
