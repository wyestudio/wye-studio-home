"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron } from "@/components/ui/Chevron";

/*
  「이렇게 플레이해요」 — 어떤 방탈출인지 그림으로 보여준다(2026-10-29 대표님 시안).

  왜 필요한가
    손님이 가장 많이 묻는 건 순서가 아니라 **방식**이다. 방탈출이라고 하면 '우리 팀만 작은 방에
    갇히는 것' 을 떠올리는데, 파티모드는 큰 방 하나에 여러 팀이 같이 들어가 점수로 겨룬다.
    글로 적어 둬도 머릿속 그림이 안 바뀌어서, 글 대신 그림 두 가지로 보여준다.
      1. 나란히 비교 — 파티모드는 '보통 방탈출 vs 바-ㅇ탈출', 노말모드는 '파티모드 vs 노말모드'
      2. 방을 위에서 내려다본 지도 — 단계를 넘기면 팀이 움직인다
  모드마다 이야기가 다르다: 파티모드는 여러 팀 점수 대결, 노말모드는 일반 방탈출처럼 우리 팀만
  예약해 방 하나를 통째로 쓴다(대표님).

  ⚠️ 지도에 바(운영진 자리)는 그리지 않는다 — 스포일러가 될 수 있다(대표님).
     그리는 건 스크린 · 팀 테이블 · 단서 자리뿐이다.
  ⚠️ 미니게임은 스크린에 뜬 문제를 보고 팀 게임패드의 버저를 누르는 방식이다(대표님). 설명문에는
     방법까지 적지 않는다 — 문제 풀이 중 돌발로 나온다는 것과 포인트를 얻는다는 것만.
  ⚠️ 기기 이름은 '게임패드' 다. 단체 페이지 FAQ 와 같은 말을 쓴다.
  ⚠️ 마지막 단계는 '순위' 가 아니라 '플레이 결과' 다 — 처음 보는 사람들 앞에서 순위가 까발려지는
     것처럼 보이면 내향적인 손님이 부담스러워한다(대표님). 왕관 · 등수 표시를 넣지 않는다.
  ⚠️ 문구는 진행 순서 블록(어드민 timetable · timebar)과 같은 이야기를 한다. 진행이 바뀌면 둘 다 고친다.
  ⚠️ 그림은 전부 이 파일의 SVG 다. 사람 하나 = 9×11 칸 도트(PERSON).
*/

export type HowToPlayMode = "party" | "normal";

const TEAMS = [
  { key: "A", color: "#f082f4" },
  { key: "B", color: "#fbcf4a" },
  { key: "C", color: "#6cc5bd" },
] as const;

type Pos = [number, number];

/** 지금 단계에서 지도가 보여줄 장면. */
type Scene = "icebreak" | "start" | "search" | "pad" | "buzzer" | "rank" | "market";

type Step = {
  title: string;
  desc: string;
  scene: Scene;
  /** 팀마다 서 있는 자리(묶음 가운데). 모드의 teams 순서와 같다. */
  at: Pos[];
  score: number[];
  /** 위 진행 막대(phases)의 몇 번째 칸에 속하는가. */
  phase?: number;
};

/** 팀 테이블 자리 — 단계 대부분에서 팀이 돌아오는 곳. */
const TABLE: Pos[] = [
  [38, 50],
  [100, 50],
  [162, 50],
];

/** 지도 속 사람 배율. 7×8 칸 그대로는 휴대폰에서 너무 작다. */
const MAP_SCALE = 1.6;

const MODES: Record<
  HowToPlayMode,
  {
    /** 크게 쓰는 한 줄 요약. 강조할 낱말은 짝수 칸. */
    summary: string[];
    compare: { label: string; desc: string; art: "separate" | "together" | "alone" }[];
    /** 지도에 나오는 팀(TEAMS 의 번호). */
    teams: number[];
    /** 지도에서 각 팀의 테이블. */
    tables: Pos[];
    /**
     * 지도 위 진행 막대. 칸 폭은 weight 비율이다 — **분을 적지 않는다**(2026-10-29 대표님).
     * 실제로는 아이스브레이킹 20분 · 방탈출+미니게임 120분 · 코인마켓 20분에 안내 등 20분이 더
     * 있는데, 분을 적으면 "코인마켓에 20분이나?" 같은 반응이 나와서 비율로만 보인다.
     * 노말모드도 시간 막대(timebar) 블록 대신 이 막대를 쓴다(방탈출 90분 · 코인마켓 10분, 2026-10-30).
     */
    phases?: { title: string; weight: number }[];
    steps: Step[];
  }
> = {
  party: {
    summary: ["방 하나", " · 여러 팀 · ", "점수 대결"],
    compare: [
      { label: "보통 방탈출", desc: "팀마다 다른 방에 들어가 탈출해요", art: "separate" },
      { label: "바-ㅇ탈출 파티모드", desc: "큰 방 하나에 모든 팀이 같이, 점수로 겨뤄요", art: "together" },
    ],
    teams: [0, 1, 2],
    tables: TABLE,
    phases: [
      { title: "아이스브레이킹 뇌풀기", weight: 20 },
      { title: "방탈출 + 돌발 미니게임", weight: 120 },
      { title: "코인마켓", weight: 20 },
    ],
    steps: [
      {
        title: "아이스브레이킹 뇌풀기",
        desc: "가벼운 게임으로 어색함을 풀고 머리를 예열해요.",
        scene: "icebreak",
        at: [
          [64, 100],
          [100, 104],
          [136, 100],
        ],
        score: [0, 0, 0],
        phase: 0,
      },
      {
        title: "팀 나누기",
        desc: "여러 팀으로 나눠 자리에 앉아요. 팀 이름도 같이 정해요.",
        scene: "start",
        at: TABLE,
        score: [0, 0, 0],
        phase: 1,
      },
      {
        title: "단서 찾기",
        desc: "방 곳곳에 있는 단서를 팀끼리 찾아다녀요. 다른 팀도 같은 방에서 찾고 있어요.",
        scene: "search",
        at: [
          [28, 40],
          [80, 100],
          [152, 40],
        ],
        score: [0, 0, 0],
        phase: 1,
      },
      {
        title: "게임패드로 정답 입력",
        desc: "팀마다 받은 게임패드에 답을 넣으면 포인트를 획득해요.",
        scene: "pad",
        at: TABLE,
        score: [120, 100, 130],
        phase: 1,
      },
      {
        title: "돌발 미니게임",
        desc: "문제를 푸는 중간중간 돌발 미니게임이 등장해요. 맞히면 포인트를 획득해요.",
        scene: "buzzer",
        at: TABLE,
        score: [120, 100, 160],
        phase: 1,
      },
      {
        title: "결과 발표",
        desc: "스크린에 플레이 결과가 떠요.",
        scene: "rank",
        at: TABLE,
        score: [120, 100, 160],
        phase: 1,
      },
      {
        title: "코인마켓",
        desc: "모은 포인트로 굿즈를 고르거나 뽑기에 도전해요.",
        scene: "market",
        at: TABLE,
        score: [120, 100, 160],
        phase: 2,
      },
    ],
  },
  normal: {
    summary: ["우리 팀만", " · 방 하나를 ", "통째로"],
    compare: [
      { label: "파티모드", desc: "여러 팀이 한 방에서 점수로 겨뤄요", art: "together" },
      { label: "노말모드", desc: "일반 방탈출처럼 우리 팀만 예약해요", art: "alone" },
    ],
    teams: [0],
    tables: [TABLE[1]],
    phases: [
      { title: "방탈출", weight: 90 },
      { title: "코인마켓", weight: 10 },
    ],
    steps: [
      {
        title: "우리 팀만 입장",
        desc: "예약한 우리 팀만 방에 들어가요.",
        scene: "start",
        at: [TABLE[1]],
        score: [0],
        phase: 0,
      },
      {
        title: "단서 찾기",
        desc: "방 곳곳에 있는 단서를 우리 팀끼리 찾아요.",
        scene: "search",
        at: [[30, 40]],
        score: [0],
        phase: 0,
      },
      {
        title: "게임패드로 정답 입력",
        desc: "게임패드에 답을 넣으면 포인트를 획득해요. 힌트도 쓸 수 있어요.",
        scene: "pad",
        at: [TABLE[1]],
        score: [110],
        phase: 0,
      },
      {
        title: "이달의 랭킹 도전",
        desc: "힌트 없이 풀면 우리 팀 기록이 이달의 랭킹에 올라가요. 인원별로 따로 겨뤄요.",
        scene: "rank",
        at: [TABLE[1]],
        score: [110],
        phase: 0,
      },
      {
        title: "코인마켓",
        desc: "모은 포인트로 굿즈를 고르거나 뽑기에 도전해요.",
        scene: "market",
        at: [TABLE[1]],
        score: [110],
        phase: 1,
      },
    ],
  },
};

/** 단서가 숨어 있는 자리(벽 쪽). 단서 찾기 단계에서 반짝인다. */
const CLUES: Pos[] = [
  [12, 22],
  [12, 92],
  [62, 108],
  [100, 108],
  [160, 14],
  [188, 92],
  [188, 30],
];

const AUTOPLAY_MS = 3600;

export function HowToPlay({ accent, mode }: { accent: string; mode: HowToPlayMode }) {
  const m = MODES[mode];
  const STEPS = m.steps;
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 화면에 보일 때만 저절로 넘긴다. 손님이 한 번 누르면 그때부터는 손님 속도대로.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [auto, inView, step, STEPS.length]);

  const go = (n: number) => {
    setAuto(false);
    setStep((n + STEPS.length) % STEPS.length);
  };

  // 모드를 바꾸면 단계 수는 같아도 이야기가 달라진다 — 처음부터 보여준다.
  const [shownMode, setShownMode] = useState(mode);
  if (shownMode !== mode) {
    setShownMode(mode);
    setStep(0);
    setAuto(true);
  }

  const cur = STEPS[Math.min(step, STEPS.length - 1)];
  const single = m.teams.length === 1;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      {/* ── 1. 한 줄 요약 + 나란히 비교 ── */}
      <div className="flex flex-col gap-5">
        <p className="text-center text-h3 font-extrabold break-keep">
          {m.summary.map((part, i) => (
            <span key={i} style={i % 2 === 0 ? { color: accent } : undefined}>
              {part}
            </span>
          ))}
        </p>
        {/*
          ⚠️ 카드(테두리 · 바탕 상자)로 감싸지 않는다. 바로 위 모드 선택 창(파티/노말)과 똑같이 생긴
             두 칸이 되어, 한쪽만 강조돼 있으니 눌러서 고르는 버튼처럼 보였다(2026-10-29 대표님).
             그림 두 장을 VS 로 잇는다. 오른쪽(지금 모드)은 상자 없이 강조한다 — 그림을 더 크게,
             강조색 빛을 두르고, 이름을 한 단계 크게. 왼쪽은 조금 흐리게 눌러 둔다.
        */}
        <div className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] items-end gap-2 sm:gap-4">
          <CompareItem {...m.compare[0]} />
          <span className="mb-[30%] text-label font-extrabold text-muted">VS</span>
          {/* 오른쪽이 지금 보고 있는 모드다. */}
          <CompareItem {...m.compare[1]} accent={accent} />
        </div>
      </div>

      {/* ── 2. 진행 막대 + 방 지도 + 단계 ── */}
      <div className="flex flex-col gap-4">
        {m.phases && (
          <PhaseBar
            phases={m.phases}
            steps={STEPS}
            step={step}
            accent={accent}
            onPick={(i) => go(STEPS.findIndex((x) => x.phase === i))}
          />
        )}
        <div
          ref={ref}
          className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-center md:gap-8"
        >
          <div className="overflow-hidden rounded-xl border border-line-subtle bg-fill-subtle">
            <RoomMap mode={mode} step={cur} accent={accent} />
            {/* 포인트판 — 단계가 넘어갈수록 오른다. 등수는 붙이지 않는다(위 주석). */}
            <div className={`grid border-t border-line-subtle ${single ? "grid-cols-1" : "grid-cols-3"}`}>
              {m.teams.map((ti, k) => {
                const t = TEAMS[ti];
                return (
                  <div key={t.key} className="flex items-center justify-center gap-2 py-2.5">
                    <span
                      className="flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-micro font-extrabold text-background"
                      style={{ backgroundColor: t.color }}
                    >
                      {single ? "우리 팀" : t.key}
                    </span>
                    <span className="text-label font-semibold tabular-nums">
                      {cur.score[k]}
                      <span className="text-micro text-muted">P</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* 지금 단계 설명 — 한 줄이라 글 싫어하는 분도 읽는다. */}
            <div className="flex items-start gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-label font-extrabold text-background"
                style={{ backgroundColor: accent }}
              >
                {step + 1}
              </span>
              <div className="min-h-[4.5rem] flex-1">
                <p className="text-body font-semibold">{cur.title}</p>
                <p className="mt-0.5 text-body-sm leading-relaxed text-muted break-keep">{cur.desc}</p>
              </div>
            </div>

            {/*
              단계 이동 — 숫자 칸 일곱 개는 좁고 딱딱해서(2026-10-29 대표님) 점으로 바꿨다. 지금 단계만
              길쭉한 알약이 되고, 자동 넘김 중이면 그 안이 차오르며 남은 시간을 보인다.
            */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => go(step - 1)}
                aria-label="이전 단계"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill text-muted transition-colors hover:bg-fill-strong"
              >
                <Chevron dir="left" />
              </button>
              <div className="flex items-center gap-1.5" role="tablist" aria-label="플레이 단계">
                {STEPS.map((s, i) => {
                  const on = i === step;
                  return (
                    <button
                      key={s.title}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      aria-label={`${i + 1}. ${s.title}`}
                      onClick={() => go(i)}
                      // 누르기 쉽게 버튼은 크게, 보이는 점은 작게.
                      className="flex h-10 items-center justify-center px-0.5"
                    >
                      <span
                        className="relative block h-2.5 overflow-hidden rounded-full transition-[width] duration-300"
                        style={{
                          width: on ? "1.75rem" : "0.625rem",
                          backgroundColor: on ? `${accent}55` : i < step ? `${accent}aa` : "var(--color-fill-strong)",
                        }}
                      >
                        {on && (
                          <span
                            key={`${step}-${auto && inView}`}
                            className={`absolute inset-y-0 left-0 rounded-full ${auto && inView ? "how-fill" : ""}`}
                            style={{
                              width: auto && inView ? undefined : "100%",
                              backgroundColor: accent,
                              animationDuration: `${AUTOPLAY_MS}ms`,
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => go(step + 1)}
                aria-label="다음 단계"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-background transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                <Chevron dir="right" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes how-fill { from { width: 0% } to { width: 100% } }
        .how-fill { animation: how-fill linear forwards; }
        @keyframes how-blink { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        .how-blink { animation: how-blink 1s steps(2) infinite; }
        @keyframes how-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } }
        .how-bob { animation: how-bob .6s steps(2) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .how-blink, .how-bob, .how-fill { animation: none; }
          .how-move { transition: none !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * 지도 위 진행 막대 — 굵은 트랙 위를 꼬마 하나가 지금 단계 자리까지 걸어간다(2026-10-29 대표님).
 * 트랙 칸 폭이 시간 비율이다(분은 적지 않는다). 지나온 길은 강조색으로 찬다.
 * 칸 이름이나 칸을 누르면 그 칸의 첫 단계로 간다.
 * ⚠️ 이름은 트랙 **아래**에 단다. 비율대로면 짧은 칸이 휴대폰에서 40px 남짓이라 이름이 안 들어가고,
 *    최소 폭을 주면 비율이 무너져 '방탈출이 제일 길다' 가 안 보였다.
 */
function PhaseBar({
  phases,
  steps,
  step,
  accent,
  onPick,
}: {
  phases: { title: string; weight: number }[];
  steps: Step[];
  step: number;
  accent: string;
  onPick: (i: number) => void;
}) {
  const curPhase = steps[step]?.phase ?? 0;
  const last = phases.length - 1;
  const total = phases.reduce((a, p) => a + p.weight, 0);
  const starts = phases.map((_, i) => phases.slice(0, i).reduce((a, p) => a + p.weight, 0) / total);
  // 꼬마 자리 — 지금 칸 안에서 몇 번째 단계인지만큼 나아간다.
  const inPhase = steps.map((x, k) => ({ x, k })).filter((o) => o.x.phase === curPhase);
  const nth = inPhase.findIndex((o) => o.k === step);
  const pos = (starts[curPhase] + ((nth + 0.5) / inPhase.length) * (phases[curPhase].weight / total)) * 100;

  return (
    <div role="tablist" aria-label="진행 순서" className="flex flex-col gap-2">
      <div className="relative pt-7">
        {/* 걸어가는 꼬마 — 지도 속 사람과 같은 그림 */}
        <div
          aria-hidden
          className="how-move absolute top-0 -translate-x-1/2"
          style={{ left: `${pos}%`, transition: "left 0.7s cubic-bezier(.5,0,.3,1)" }}
        >
          <svg viewBox="0 0 9 11" className="how-bob block h-6 w-auto" shapeRendering="crispEdges">
            <Person x={0} y={0} color={accent} />
          </svg>
        </div>
        {/* 트랙 */}
        <div className="relative flex h-4 gap-1">
          {phases.map((ph, i) => (
            <button
              key={ph.title}
              type="button"
              role="tab"
              aria-selected={curPhase === i}
              aria-label={ph.title}
              onClick={() => onPick(i)}
              className="relative h-full min-w-0 overflow-hidden rounded-full bg-fill-strong"
              style={{ flexGrow: ph.weight, flexBasis: 0 }}
            >
              {/* 지나온 만큼 강조색 */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                style={{
                  backgroundColor: accent,
                  width:
                    i < curPhase
                      ? "100%"
                      : i > curPhase
                        ? "0%"
                        : `${((nth + 0.5) / inPhase.length) * 100}%`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between gap-3" aria-hidden>
        {phases.map((ph, i) => (
          <button
            key={ph.title}
            type="button"
            tabIndex={-1}
            onClick={() => onPick(i)}
            className={`text-label font-semibold break-keep ${i === 0 ? "max-w-[6rem] text-left" : i === last ? "text-right" : "text-center"} ${curPhase === i ? "" : "text-muted"}`}
            style={curPhase === i ? { color: accent } : undefined}
          >
            {ph.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompareItem({
  label,
  desc,
  art,
  accent,
}: {
  label: string;
  desc: string;
  art: "separate" | "together" | "alone";
  accent?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${accent ? "" : "opacity-60"}`}>
      <div
        className="w-full"
        // 상자 대신 그림 둘레에 강조색 빛 — 버튼처럼 보이지 않으면서 눈이 먼저 간다.
        style={accent ? { filter: `drop-shadow(0 0 10px ${accent}80)` } : undefined}
      >
        {art === "separate" ? <SeparateRooms /> : <OneRoom alone={art === "alone"} />}
      </div>
      <p
        className={`${accent ? "text-body" : "text-label"} font-extrabold break-keep`}
        style={accent ? { color: accent } : undefined}
      >
        {label}
      </p>
      <p className="-mt-1 text-body-sm leading-snug text-muted break-keep">{desc}</p>
    </div>
  );
}

/* ───────────── 도트 그림 ───────────── */

const INK = "#252231";
const SKIN = "#f0e7d8";
const FLOOR = "#2a2342";
const WALL = "#4b3f73";
const GOLD = "#fbcf4a";

/*
  사람 한 명 — 핀(어드벤처 타임) 비율의 꼬마. 머리와 몸이 거의 같은 크기다(2026-10-29 대표님 참고 그림).
  K 테두리 · H 머리카락 · S 피부 · E 눈 · B 볼터치 · C 팀 색 옷 · L 바지 · "." 빈칸.
  ⚠️ 머리카락은 정수리와 일자 앞머리만 조금. 옆으로 넘긴 앞머리(한쪽만 칠함)는 작게 보면 머리가
     반만 있는 것처럼 보여 양쪽 같게 칠한다. 짧은 머리는 다 남자로, 긴 머리를 섞으면
     성별을 나눈 것처럼, 민머리는 하얀 동그라미처럼 보였다(2026-10-29 대표님).
  ⚠️ 머리는 위아래 줄을 한 칸씩 좁혀 **둥글게** 깎는다. 네모난 얼굴은 로봇처럼 보였다.
*/
const PERSON = [
  "..KKKKK..",
  ".KHHHHHK.",
  "KHHHHHHHK",
  "KSSSSSSSK",
  "KSSESESSK",
  "KSBSSSBSK",
  ".KSSSSSK.",
  ".KCCCCCK.",
  "KSCCCCCSK",
  ".KLLLLLK.",
  ".KK...KK.",
];

/** 머리카락 색 — 전원 같은 갈색. */
const HAIR = "#8a5a32";

/** 사람 하나. (x, y) 는 왼쪽 위. 9×11 칸. */
function Person({ x, y, color }: { x: number; y: number; color: string }) {
  const fill: Record<string, string> = { K: INK, H: HAIR, S: SKIN, E: INK, B: "#f4a3b4", C: color, L: "#3d3560" };
  return (
    <g transform={`translate(${x} ${y})`}>
      {PERSON.flatMap((row, r) =>
        [...row].map((ch, c) =>
          ch === "." ? null : <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={fill[ch]} />,
        ),
      )}
    </g>
  );
}

/** 한 팀 세 명. (cx, cy) 가 묶음 가운데. */
function Team({ cx, cy, t, bob = false }: { cx: number; cy: number; t: (typeof TEAMS)[number]; bob?: boolean }) {
  return (
    <g className={bob ? "how-bob" : undefined}>
      <Person x={cx - 12} y={cy - 5} color={t.color} />
      <Person x={cx + 3} y={cy - 5} color={t.color} />
      {/* 가운데 사람은 한 칸 위 · 맨 앞에 — 셋이 살짝 겹쳐 무리로 보이게 */}
      <Person x={cx - 4.5} y={cy - 8} color={t.color} />
    </g>
  );
}

function Lock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={1} y={0} width={4} height={1} fill="#b6b4ca" />
      <rect x={1} y={0} width={1} height={3} fill="#b6b4ca" />
      <rect x={4} y={0} width={1} height={3} fill="#b6b4ca" />
      <rect x={0} y={3} width={6} height={4} fill={GOLD} />
      <rect x={2.5} y={4} width={1} height={2} fill={INK} />
    </g>
  );
}

/** 동전 하나. (x, y) 는 왼쪽 위. 5×5 칸. */
function Coin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={1} y={0} width={3} height={5} fill="#d4930f" />
      <rect x={0} y={1} width={5} height={3} fill="#d4930f" />
      <rect x={1} y={1} width={3} height={3} fill={GOLD} />
      <rect x={2} y={1} width={1} height={3} fill="#fff3c4" />
    </g>
  );
}

/** 보통 방탈출 — 작은 방 셋, 팀마다 하나씩. */
function SeparateRooms() {
  return (
    <svg viewBox="0 0 90 60" className="block w-full" shapeRendering="crispEdges" aria-hidden>
      {[0, 1, 2].map((i) => {
        const x = 2 + i * 29.3;
        return (
          <g key={i}>
            <rect x={x} y={14} width={27} height={36} fill={WALL} />
            <rect x={x + 2} y={16} width={23} height={32} fill={FLOOR} />
            <Team cx={x + 13.5} cy={34} t={TEAMS[i]} />
            <Lock x={x + 10.5} y={4} />
          </g>
        );
      })}
    </svg>
  );
}

/** 큰 방 하나. alone 이면 우리 팀만(노말모드), 아니면 세 팀(파티모드). */
function OneRoom({ alone = false }: { alone?: boolean }) {
  return (
    <svg viewBox="0 0 90 60" className="block w-full" shapeRendering="crispEdges" aria-hidden>
      <rect x={2} y={6} width={86} height={50} fill={WALL} />
      <rect x={4} y={8} width={82} height={46} fill={FLOOR} />
      {/* 정면 스크린 */}
      <rect x={30} y={10} width={30} height={6} fill="#0d0b18" />
      {alone ? (
        <>
          <rect x={32} y={12} width={18} height={2} fill={TEAMS[0].color} />
          <Team cx={45} cy={38} t={TEAMS[0]} bob />
          {/* 방 전체가 우리 차지 — 네 귀퉁이 반짝이 */}
          <g className="how-blink" fill={GOLD}>
            <rect x={10} y={20} width={2} height={2} />
            <rect x={78} y={20} width={2} height={2} />
            <rect x={10} y={46} width={2} height={2} />
            <rect x={78} y={46} width={2} height={2} />
          </g>
        </>
      ) : (
        <>
          <rect x={32} y={12} width={8} height={2} fill={TEAMS[0].color} />
          <rect x={42} y={12} width={6} height={2} fill={TEAMS[1].color} />
          <rect x={50} y={12} width={7} height={2} fill={TEAMS[2].color} />
          <Team cx={20} cy={36} t={TEAMS[0]} bob />
          <Team cx={45} cy={44} t={TEAMS[1]} bob />
          <Team cx={70} cy={36} t={TEAMS[2]} bob />
          {/* VS 반짝이 */}
          <g className="how-blink" fill={GOLD}>
            <rect x={32} y={28} width={2} height={2} />
            <rect x={56} y={28} width={2} height={2} />
            <rect x={44} y={24} width={2} height={2} />
          </g>
        </>
      )}
    </svg>
  );
}

/** 방을 위에서 본 지도. viewBox 200×120. */
function RoomMap({ mode, step, accent }: { mode: HowToPlayMode; step: Step; accent: string }) {
  const m = MODES[mode];
  const { scene } = step;
  const searching = scene === "search";
  const buzzer = scene === "buzzer";
  const icebreak = scene === "icebreak";
  // 버저를 먼저 누른 팀 — 이 단계에서 포인트가 오른 팀.
  const prev = m.steps[m.steps.indexOf(step) - 1];
  const buzzWinner = buzzer && prev ? step.score.findIndex((s, k) => s > prev.score[k]) : -1;

  return (
    <svg
      viewBox="0 0 200 120"
      className="block w-full"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${step.title} — ${step.desc}`}
    >
      {/* 벽 · 바닥 (바닥에 옅은 타일 격자) */}
      <rect x={0} y={0} width={200} height={120} fill={WALL} />
      <rect x={4} y={4} width={192} height={112} fill={FLOOR} />
      <g fill="#ffffff" opacity={0.04}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={`v${i}`} x={4 + i * 16} y={4} width={1} height={112} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={`h${i}`} x={4} y={4 + i * 16} width={192} height={1} />
        ))}
      </g>

      <Screen scene={scene} accent={accent} teams={m.teams} score={step.score} />

      {/* 단서 자리 — 단서 찾기 단계에서 반짝인다 */}
      {CLUES.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 4} y={y - 4} width={8} height={8} fill="#845835" />
          <rect x={x - 3} y={y - 3} width={6} height={1} fill="#c9925a" />
          <text x={x} y={y + 3.2} textAnchor="middle" fontSize={6} fontWeight={800} fill={GOLD}>
            ?
          </text>
          {searching && (
            <g className="how-blink" fill={GOLD} style={{ animationDelay: `${(i % 3) * 0.2}s` }}>
              <rect x={x - 1} y={y - 8} width={2} height={2} />
              <rect x={x + 4} y={y - 5} width={2} height={2} />
            </g>
          )}
        </g>
      ))}

      {/* 팀 테이블과 게임패드 */}
      {m.tables.map(([x, y], k) => {
        const t = TEAMS[m.teams[k]];
        const lit = scene === "pad" || (buzzer && k === buzzWinner);
        return (
          <g key={k}>
            <rect x={x - 18} y={y + 12} width={36} height={11} fill="#c9925a" />
            <rect x={x - 18} y={y + 21} width={36} height={2} fill="#845835" />
            <rect x={x - 7} y={y + 13} width={14} height={8} fill={INK} />
            <rect x={x - 6} y={y + 14} width={12} height={6} fill={lit ? t.color : "#3d3560"} />
            {/* 미니게임 — 게임패드 화면이 커다란 버저가 된다 */}
            {buzzer && (
              <g className={k === buzzWinner ? "how-blink" : undefined}>
                <rect x={x - 3} y={y + 15} width={6} height={4} fill={k === buzzWinner ? "#e85d75" : "#6b6880"} />
                <rect x={x - 2} y={y + 15} width={4} height={1} fill="#ffffff" opacity={0.5} />
              </g>
            )}
          </g>
        );
      })}

      {/* 아이스브레이킹 — 다 같이 모인 무리 위로 반짝이(아직 팀 깃발 없음) */}
      {icebreak && (
        <g className="how-blink" fill={GOLD}>
          <rect x={80} y={74} width={2} height={2} />
          <rect x={99} y={70} width={2} height={2} />
          <rect x={118} y={74} width={2} height={2} />
          <rect x={58} y={84} width={2} height={2} />
          <rect x={140} y={84} width={2} height={2} />
        </g>
      )}

      {/* 팀 — 단계마다 자리로 미끄러져 간다 */}
      {m.teams.map((ti, k) => {
        const t = TEAMS[ti];
        const [x, y] = step.at[k];
        const single = m.teams.length === 1;
        return (
          <g
            key={t.key}
            className="how-move"
            style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 0.9s cubic-bezier(.5,0,.3,1)" }}
          >
            <g transform={`scale(${MAP_SCALE})`}>
              <Team cx={0} cy={0} t={t} bob={searching || buzzer || icebreak || scene === "market"} />
              {/* 팀 깃발 — 노말모드는 한 팀이라, 아이스브레이킹은 아직 팀을 안 나눠서 없다 */}
              {!single && !icebreak && (
                <>
                  <rect x={-3} y={-17} width={7} height={7} fill={t.color} />
                  <text x={0.5} y={-11.6} textAnchor="middle" fontSize={6} fontWeight={800} fill={INK}>
                    {t.key}
                  </text>
                </>
              )}
              {/* 게임패드에 답을 넣는 순간의 +포인트 */}
              {scene === "pad" && (
                <text x={9} y={-10} fontSize={6} fontWeight={800} fill={t.color} className="how-blink">
                  +
                </text>
              )}
              {/* 버저를 먼저 누른 팀의 느낌표 */}
              {buzzer && k === buzzWinner && (
                <text x={9} y={-10} fontSize={7} fontWeight={800} fill="#e85d75" className="how-blink">
                  !
                </text>
              )}
              {/* 코인마켓 — 머리 위로 동전이 튄다 */}
              {scene === "market" && (
                <g className="how-blink">
                  <Coin x={-12} y={-16} />
                  <Coin x={-2.5} y={-20} />
                  <Coin x={7} y={-16} />
                </g>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** 정면 스크린. 미니게임엔 문제가, 결과 단계엔 막대가 뜬다. */
function Screen({ scene, accent, teams, score }: { scene: Scene; accent: string; teams: number[]; score: number[] }) {
  const on = scene === "buzzer" || scene === "rank";
  const BARS = [50, 38, 28];
  return (
    <g>
      <rect x={66} y={5} width={68} height={16} fill="#0d0b18" />
      <rect x={66} y={5} width={68} height={1} fill={on ? accent : "#3d3560"} />
      {scene === "buzzer" && (
        <g className="how-blink">
          <text x={100} y={17} textAnchor="middle" fontSize={11} fontWeight={800} fill={GOLD}>
            ?
          </text>
        </g>
      )}
      {scene === "rank" &&
        (teams.length > 1
          ? // 플레이 결과 — 팀 순서대로. 등수순으로 줄 세우지 않는다.
            teams.map((ti, k) => {
              const w = Math.round((score[k] / Math.max(...score, 1)) * 50);
              return (
                <g key={ti}>
                  <rect x={70} y={8 + k * 4} width={6} height={3} fill={TEAMS[ti].color} />
                  <rect x={78} y={8 + k * 4} width={w} height={3} fill={TEAMS[ti].color} opacity={0.75}>
                    <animate attributeName="width" from="0" to={w} dur="0.8s" fill="freeze" />
                  </rect>
                </g>
              );
            })
          : // 노말모드 — 이달의 랭킹 속 우리 팀(다른 기록은 회색)
            BARS.map((w, r) => {
              const ours = r === 1;
              const c = ours ? TEAMS[teams[0]].color : "#6b6880";
              return (
                <g key={r}>
                  <rect x={70} y={8 + r * 4} width={6} height={3} fill={c} />
                  <rect x={78} y={8 + r * 4} width={w} height={3} fill={c} opacity={ours ? 0.9 : 0.5}>
                    <animate attributeName="width" from="0" to={w} dur="0.8s" fill="freeze" />
                  </rect>
                </g>
              );
            }))}
      {!on && (
        <text x={100} y={15.5} textAnchor="middle" fontSize={6} fill="#6b6880" fontWeight={700}>
          SCREEN
        </text>
      )}
    </g>
  );
}
