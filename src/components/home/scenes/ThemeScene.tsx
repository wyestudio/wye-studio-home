"use client";

import { useScene } from "@/components/home/scroll-stage/ScrollStageContext";
import { SceneShell } from "@/components/home/scroll-stage/SceneShell";
import { PlanetSystem } from "@/components/home/space/PlanetSystem";
import type { HomeThemeCard } from "@/components/home/space/types";
import { SeasonArt } from "@/components/season/SeasonArt";
import { orbitron } from "@/components/home/orbitron";

export function ThemeScene({
  index = 0,
  total = 1,
  range,
  themes,
}: {
  index?: number;
  total?: number;
  // ScrollStage가 weight prop을 보고 계산해서 넘겨주는 실제 스크롤 구간(이 컴포넌트는 weight를 직접 쓰진 않음).
  weight?: number;
  range?: { start: number; end: number; unitSpan?: number };
  themes: HomeThemeCard[];
}) {
  const { local, reduceMotion, isFirst, isLast } = useScene(index, total, range);

  return (
    <SceneShell
      local={local}
      reduceMotion={reduceMotion}
      index={index}
      isFirst={isFirst}
      isLast={isLast}
      variant="rise"
      zoom={false}
    >
      {/*
        행성계는 장면 전체(화면 가득)를 쓴다 — 행성이 화면 밖에서 들어와 깊이 쪽으로 사라져야
        끝이 없는 우주처럼 보인다. 제목은 그 위에 얹는다(누름은 장면이 받도록 통과시킨다).
        모션 줄이기에서는 장면이 평범한 섹션으로 쌓이므로 높이를 직접 준다.
      */}
      <div className={reduceMotion ? "relative -mx-6 h-[100svh] min-h-[40rem]" : "absolute inset-0"}>
        <PlanetSystem themes={themes} local={reduceMotion ? 0.5 : local} />
        {/*
          제목은 Orbitron — 각진 SF 글꼴로 우주선 표지처럼. 글자가 넓어 자간은 거의 그대로 둔다.
        */}
        <h2
          className={`${orbitron.className} pointer-events-none absolute left-5 top-20 text-2xl font-semibold tracking-[0.02em] sm:left-[5%] sm:top-28 sm:text-4xl`}
        >
          <span className="season-heading">
            Planets to Escape
            {/* 시즌 박쥐. 왼쪽으로 48px 튀어나가서, 제목 옆 여백이 넉넉한 lg 부터만. */}
            <SeasonArt art="bat-orange" className="season-title-bat hidden lg:block" />
          </span>
        </h2>
      </div>
    </SceneShell>
  );
}
