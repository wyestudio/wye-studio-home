"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron } from "@/components/ui/Chevron";

/*
  「이렇게 플레이해요」 — 파티모드가 어떤 방탈출인지 그림으로 보여준다(2026-10-29 대표님 시안).

  왜 필요한가
    손님이 가장 많이 묻는 건 순서가 아니라 **방식**이다. 방탈출이라고 하면 '우리 팀만 작은 방에
    갇히는 것' 을 떠올리는데, 바-ㅇ탈출은 큰 방 하나에 여러 팀이 같이 들어가 점수로 겨룬다.
    글로 적어 둬도 머릿속 그림이 안 바뀌어서, 글 대신 그림 두 가지로 보여준다.
      1. 보통 방탈출 vs 바-ㅇ탈출 — 나란히 놓고 한눈에 차이를 보이게
      2. 방을 위에서 내려다본 지도 — 단계를 넘기면 팀이 움직인다
  지도 배치는 실제 공간을 따랐다(후기 블로그 사진 · 글): 가운데 테이블, 한쪽에 바와 운영진,
  벽 곳곳에 단서, 정면 스크린에 최종 순위.

  ⚠️ 문구는 진행 순서 블록(어드민 timetable)과 같은 이야기를 한다. 진행이 바뀌면 둘 다 고친다.
  ⚠️ 그림은 전부 이 파일의 SVG 다. 사람 하나 = 7×8 칸 도트.
*/

const TEAMS = [
  { key: "A", color: "#f082f4", shade: "#c45fc9" },
  { key: "B", color: "#fbcf4a", shade: "#d4930f" },
  { key: "C", color: "#6cc5bd", shade: "#3f8f88" },
] as const;

type Pos = [number, number];

/** 팀 테이블 자리 — 단계 대부분에서 팀이 돌아오는 곳. */
const TABLE: Pos[] = [
  [38, 50],
  [100, 50],
  [160, 50],
];

/** 지도 속 사람 배율. 7×8 칸 그대로는 휴대폰에서 너무 작다. */
const MAP_SCALE = 1.6;

const STEPS: {
  title: string;
  desc: string;
  /** 팀마다 서 있는 자리(묶음 가운데). */
  at: Pos[];
  score: [number, number, number];
}[] = [
  {
    title: "팀 나누기",
    desc: "모두 한 방에 모여 여러 팀으로 나눠요. 팀 이름도 같이 정해요.",
    at: TABLE,
    score: [0, 0, 0],
  },
  {
    title: "단서 찾기",
    desc: "방 곳곳에 숨은 단서를 팀끼리 찾아다녀요. 다른 팀도 같은 방에서 찾고 있어요.",
    at: [
      [28, 40],
      [80, 100],
      [150, 40],
    ],
    score: [0, 0, 0],
  },
  {
    title: "패드로 정답 입력",
    desc: "팀마다 받은 게임패드에 답을 넣으면 점수가 올라가요. 힌트를 쓰면 점수가 깎여요.",
    at: TABLE,
    score: [120, 90, 140],
  },
  {
    title: "돌발 미니게임",
    desc: "중간중간 미니게임이 열려요. 이기면 보너스 점수를 받아요.",
    at: [
      [76, 100],
      [116, 100],
      [156, 100],
    ],
    score: [150, 130, 145],
  },
  {
    title: "순위 발표",
    desc: "점수를 합쳐 스크린에 팀 순위가 떠요. 모은 포인트는 코인마켓에서 써요.",
    at: TABLE,
    score: [150, 130, 145],
  },
];

/** 단서가 숨어 있는 자리(벽 쪽). 2단계에서 반짝인다. */
const CLUES: Pos[] = [
  [12, 22],
  [12, 92],
  [62, 108],
  [96, 108],
  [160, 14],
  [180, 104],
];

const AUTOPLAY_MS = 3600;

export function HowToPlay({ accent }: { accent: string }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 화면에 보일 때만 저절로 넘긴다. 손님이 한 번 누르면 그때부터는 손님 속도대로.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.4,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [auto, inView, step]);

  const go = (n: number) => {
    setAuto(false);
    setStep((n + STEPS.length) % STEPS.length);
  };

  const cur = STEPS[step];
  const ranked = [...cur.score].map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      {/* ── 1. 한 줄 요약 + 보통 방탈출과 나란히 ── */}
      <div className="flex flex-col gap-5">
        <p className="text-center text-h3 font-extrabold break-keep">
          <span style={{ color: accent }}>방 하나</span> · 여러 팀 · <span style={{ color: accent }}>점수 대결</span>
        </p>
        <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-2.5 sm:gap-4">
          <CompareCard label="보통 방탈출" desc="팀마다 다른 방에 들어가 탈출해요" art={<SeparateRooms />} />
          <CompareCard
            label="바-ㅇ탈출"
            desc="큰 방 하나에 모든 팀이 같이, 점수로 겨뤄요"
            art={<OneRoom />}
            accent={accent}
          />
        </div>
      </div>

      {/* ── 2. 방 지도 + 단계 ── */}
      <div
        ref={ref}
        className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-center md:gap-8"
      >
        <div className="overflow-hidden rounded-xl border border-line-subtle bg-fill-subtle">
          <RoomMap step={step} accent={accent} ranked={ranked.map((r) => r.i)} />
          {/* 점수판 — 단계가 넘어갈수록 오른다. 마지막엔 순위. */}
          <div className="grid grid-cols-3 border-t border-line-subtle">
            {TEAMS.map((t, i) => {
              const rank = ranked.findIndex((r) => r.i === i) + 1;
              return (
                <div key={t.key} className="flex items-center justify-center gap-2 py-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-micro font-extrabold text-background"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.key}
                  </span>
                  <span className="text-label font-semibold tabular-nums">
                    {cur.score[i]}
                    <span className="text-micro text-muted">점</span>
                  </span>
                  {step === STEPS.length - 1 && (
                    <span className="text-micro font-extrabold" style={{ color: rank === 1 ? accent : undefined }}>
                      {rank}위
                    </span>
                  )}
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

          {/* 단계 이동 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(step - 1)}
              aria-label="이전 단계"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-subtle text-muted hover:bg-fill"
            >
              <Chevron dir="left" />
            </button>
            <div className="flex flex-1 gap-1.5" role="tablist" aria-label="플레이 단계">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`${i + 1}. ${s.title}`}
                  onClick={() => go(i)}
                  className="relative h-10 flex-1 overflow-hidden rounded-lg bg-fill"
                >
                  {/* 지금 단계는 강조색으로 채우고, 자동 넘김 중이면 차오르는 막대로 남은 시간을 보인다. */}
                  <span
                    key={`${step}-${auto && inView}`}
                    className={`absolute inset-y-0 left-0 ${i === step && auto && inView ? "how-fill" : ""}`}
                    style={{
                      width: i < step || (i === step && !(auto && inView)) ? "100%" : i === step ? undefined : "0%",
                      backgroundColor: `${accent}${i === step ? "66" : "2e"}`,
                      animationDuration: `${AUTOPLAY_MS}ms`,
                    }}
                  />
                  <span className="relative text-micro font-semibold">{i + 1}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(step + 1)}
              aria-label="다음 단계"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-subtle text-muted hover:bg-fill"
            >
              <Chevron dir="right" />
            </button>
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

function CompareCard({
  label,
  desc,
  art,
  accent,
}: {
  label: string;
  desc: string;
  art: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-line-subtle bg-fill-subtle"
      style={accent ? { borderColor: `${accent}88` } : undefined}
    >
      <div className="px-3 pt-3 sm:px-4 sm:pt-4">{art}</div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <p className="text-label font-extrabold" style={accent ? { color: accent } : undefined}>
          {label}
        </p>
        <p className="text-body-sm leading-snug text-muted break-keep">{desc}</p>
      </div>
    </div>
  );
}

/* ───────────── 도트 그림 ───────────── */

const INK = "#252231";
const SKIN = "#f0e7d8";
const FLOOR = "#2a2342";
const WALL = "#4b3f73";

/** 사람 하나. (x, y) 는 왼쪽 위. 7×8 칸. */
function Person({ x, y, color, shade }: { x: number; y: number; color: string; shade: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={1} y={0} width={5} height={4} fill={INK} />
      <rect x={2} y={1} width={3} height={3} fill={SKIN} />
      <rect x={2} y={2} width={1} height={1} fill={INK} />
      <rect x={4} y={2} width={1} height={1} fill={INK} />
      <rect x={0} y={4} width={7} height={4} fill={INK} />
      <rect x={1} y={4} width={5} height={3} fill={color} />
      <rect x={1} y={6} width={5} height={1} fill={shade} />
    </g>
  );
}

/** 한 팀 세 명. (cx, cy) 가 묶음 가운데. */
function Team({ cx, cy, t, bob = false }: { cx: number; cy: number; t: (typeof TEAMS)[number]; bob?: boolean }) {
  return (
    <g className={bob ? "how-bob" : undefined}>
      <Person x={cx - 11} y={cy - 4} color={t.color} shade={t.shade} />
      <Person x={cx - 3.5} y={cy - 7} color={t.color} shade={t.shade} />
      <Person x={cx + 4} y={cy - 4} color={t.color} shade={t.shade} />
    </g>
  );
}

function Lock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={1} y={0} width={4} height={1} fill="#b6b4ca" />
      <rect x={1} y={0} width={1} height={3} fill="#b6b4ca" />
      <rect x={4} y={0} width={1} height={3} fill="#b6b4ca" />
      <rect x={0} y={3} width={6} height={4} fill="#fbcf4a" />
      <rect x={2.5} y={4} width={1} height={2} fill={INK} />
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

/** 바-ㅇ탈출 — 큰 방 하나에 세 팀. */
function OneRoom() {
  return (
    <svg viewBox="0 0 90 60" className="block w-full" shapeRendering="crispEdges" aria-hidden>
      <rect x={2} y={6} width={86} height={50} fill={WALL} />
      <rect x={4} y={8} width={82} height={46} fill={FLOOR} />
      {/* 정면 스크린 */}
      <rect x={30} y={10} width={30} height={6} fill="#0d0b18" />
      <rect x={32} y={12} width={8} height={2} fill="#f082f4" />
      <rect x={42} y={12} width={6} height={2} fill="#fbcf4a" />
      <rect x={50} y={12} width={7} height={2} fill="#6cc5bd" />
      <Team cx={20} cy={36} t={TEAMS[0]} bob />
      <Team cx={45} cy={44} t={TEAMS[1]} bob />
      <Team cx={70} cy={36} t={TEAMS[2]} bob />
      {/* VS 반짝이 */}
      <g className="how-blink" fill="#fbcf4a">
        <rect x={32} y={28} width={2} height={2} />
        <rect x={56} y={28} width={2} height={2} />
        <rect x={44} y={24} width={2} height={2} />
      </g>
    </svg>
  );
}

/** 방을 위에서 본 지도. viewBox 200×120. */
function RoomMap({ step, accent, ranked }: { step: number; accent: string; ranked: number[] }) {
  const s = STEPS[step];
  const searching = step === 1;
  const padTime = step === 2;
  const miniGame = step === 3;
  const result = step === 4;

  return (
    <svg
      viewBox="0 0 200 120"
      className="block w-full"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${s.title} — ${s.desc}`}
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

      {/* 정면 스크린 — 마지막 단계에 순위 막대가 뜬다 */}
      <rect x={66} y={5} width={68} height={16} fill="#0d0b18" />
      <rect x={66} y={5} width={68} height={1} fill={result ? accent : "#3d3560"} />
      {result ? (
        ranked.map((ti, r) => (
          <g key={ti}>
            <rect x={70} y={8 + r * 4} width={6} height={3} fill={TEAMS[ti].color} />
            <rect x={78} y={8 + r * 4} width={[50, 38, 28][r]} height={3} fill={TEAMS[ti].color} opacity={0.75}>
              <animate attributeName="width" from="0" to={[50, 38, 28][r]} dur="0.8s" fill="freeze" />
            </rect>
          </g>
        ))
      ) : (
        <text x={100} y={15.5} textAnchor="middle" fontSize={6} fill="#6b6880" fontWeight={700}>
          SCREEN
        </text>
      )}

      {/* 바 · 운영진 (오른쪽) */}
      <rect x={184} y={36} width={10} height={50} fill="#5a3d2b" />
      <rect x={184} y={36} width={10} height={2} fill="#c9925a" />
      <text
        x={189}
        y={64}
        textAnchor="middle"
        fontSize={5}
        fill="#f0e7d8"
        fontWeight={700}
        transform="rotate(90 189 61)"
      >
        BAR
      </text>

      {/* 단서 자리 — 2단계에서 반짝인다 */}
      {CLUES.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 4} y={y - 4} width={8} height={8} fill="#845835" />
          <rect x={x - 3} y={y - 3} width={6} height={1} fill="#c9925a" />
          <text x={x} y={y + 3.2} textAnchor="middle" fontSize={6} fontWeight={800} fill="#fbcf4a">
            ?
          </text>
          {searching && (
            <g className="how-blink" fill="#fbcf4a" style={{ animationDelay: `${(i % 3) * 0.2}s` }}>
              <rect x={x - 1} y={y - 8} width={2} height={2} />
              <rect x={x + 4} y={y - 5} width={2} height={2} />
            </g>
          )}
        </g>
      ))}

      {/* 팀 테이블 */}
      {TABLE.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 18} y={y + 12} width={36} height={11} fill="#c9925a" />
          <rect x={x - 18} y={y + 21} width={36} height={2} fill="#845835" />
          {/* 테이블 위 게임패드 — 3단계에서 화면이 켜진다 */}
          <rect x={x - 6} y={y + 14} width={12} height={6} fill={INK} />
          <rect x={x - 5} y={y + 15} width={10} height={4} fill={padTime ? TEAMS[i].color : "#3d3560"} />
        </g>
      ))}

      {/* 미니게임 진행자 */}
      {miniGame && (
        <g transform={`translate(36 100) scale(${MAP_SCALE})`}>
          <Person x={-3.5} y={-4} color="#ffffff" shade="#b6b4ca" />
          <g className="how-blink" fill={accent}>
            <rect x={-8} y={-8} width={2} height={2} />
            <rect x={6} y={-8} width={2} height={2} />
          </g>
        </g>
      )}

      {/* 팀 — 단계마다 자리로 미끄러져 간다 */}
      {TEAMS.map((t, i) => {
        const [x, y] = s.at[i];
        return (
          <g
            key={t.key}
            className="how-move"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition: "transform 0.9s cubic-bezier(.5,0,.3,1)",
            }}
          >
            <g transform={`scale(${MAP_SCALE})`}>
              <Team cx={0} cy={0} t={t} bob={searching || miniGame} />
              {/* 팀 깃발 */}
              <rect x={-3} y={-17} width={7} height={7} fill={t.color} />
              <text x={0.5} y={-11.6} textAnchor="middle" fontSize={6} fontWeight={800} fill={INK}>
                {t.key}
              </text>
              {/* 패드에 답을 넣는 순간의 +점수 */}
              {padTime && (
                <text x={10} y={-12} fontSize={6} fontWeight={800} fill={t.color} className="how-blink">
                  +
                </text>
              )}
              {/* 1위 왕관 */}
              {result && ranked[0] === i && (
                <g fill="#fbcf4a">
                  <rect x={-4} y={-24} width={9} height={3} />
                  <rect x={-4} y={-26} width={1} height={2} />
                  <rect x={0} y={-27} width={1} height={3} />
                  <rect x={4} y={-26} width={1} height={2} />
                </g>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
