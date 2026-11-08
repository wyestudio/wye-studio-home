"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chevron } from "@/components/ui/Chevron";
import { FALLBACK_LOGO } from "@/components/contents/PosterImage";
import Link from "next/link";
import { PlanetPanel } from "./PlanetPanel";
import { SpaceControls } from "./SpaceControls";
import { slotLayout, SpaceScene, type SceneSlot } from "./spaceScene";
import type { HomeThemeCard, PlanetSlot } from "./types";

const DEFAULT_ACCENT = "#3dffb0";

/**
 * 홈 Planets to Escape — 원근이 있는 행성계.
 *
 * 넓은 화면: 행성들이 깊이 방향으로 늘어서 있고, 끌어서 시점을 돌린다. 행성을 누르면 카메라가
 *            다가가고 오른쪽에 브리핑 패널이 열린다.
 * 휴대폰:    행성 하나를 크게, 다음 행성은 뒤에 작게. 좌우로 밀거나 화살표로 넘긴다. 세로로
 *            밀면 페이지가 내려간다(캔버스가 touch-action: pan-y). 아래에 패널이 늘 붙어 있다.
 *
 * 테마 보기 · 모드 예약은 패널의 링크로 바로 간다 — 장면을 조작하지 않아도 된다.
 * 잠긴 행성도 누를 수 있다. 패널에 자물쇠와 "아직 탐사되지 않은 행성" 만 보인다.
 */
export function PlanetSystem({ themes, local }: { themes: HomeThemeCard[]; local: number }) {
  // 마지막 칸은 언제나 '출시 예정'. DB 에 없는 자리표시라 여기서 붙인다.
  const slots: PlanetSlot[] = useMemo(
    () => [...themes.map((theme) => ({ kind: "theme" as const, theme })), { kind: "soon" as const }],
    [themes]
  );

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sceneRef = useRef<SpaceScene | null>(null);

  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [cinema, setCinema] = useState(false);
  // 패널이 접히는 동안(0.26초) — 다 접힌 뒤에 내린다
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(0);
  const closePanel = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setSelected(null);
      setClosing(false);
    }, 260);
  }, []);
  const openPanel = useCallback((i: number) => {
    window.clearTimeout(closeTimer.current);
    setClosing(false);
    setSelected(i);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => setFocus((f) => Math.max(0, Math.min(slots.length - 1, f + dir))),
    [slots.length]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPaused(reduce);

    const sceneSlots: SceneSlot[] = slots.map((s, i) => {
      const { pos, r } = slotLayout(i);
      if (s.kind === "soon") {
        return { pos, r, accent: "#8a8a99", logo: null, locked: false, soon: true, orbits: [] };
      }
      const t = s.theme;
      return {
        pos,
        r,
        accent: t.accent_color || DEFAULT_ACCENT,
        logo: t.logo_image_path || FALLBACK_LOGO,
        locked: t.is_locked,
        soon: false,
        orbits: t.is_locked ? [] : (t.orbits ?? []).map((o) => ({ key: o.key, label: o.label, color: o.color })),
      };
    });

    const scene = new SpaceScene(
      canvas,
      host,
      sceneSlots,
      () => labelRefs.current,
      {
        onSelect: (i) => {
          if (window.innerWidth < 640) {
            if (i !== null) setFocus(i);
          } else if (i === null) closePanel();
          else openPanel(i);
        },
        onSatellite: (i, key) => {
          if (window.innerWidth < 640) setFocus(i);
          else openPanel(i);
          setActive(key);
        },
        onHoverSatellite: (key) => setActive(key),
        onSwipe: (dir) => go(dir),
      },
      reduce
    );
    sceneRef.current = scene;

    // 화면 밖이면 그리지 않는다. 홈의 장면들은 겹쳐 쌓여 있다가 밀려 들어오므로 실제로 보일 때만.
    const io = new IntersectionObserver(([e]) => scene.setOnScreen(e.isIntersecting), { threshold: 0.05 });
    io.observe(host);

    const mq = window.matchMedia("(max-width: 639px)");
    const onMq = () => setMobile(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);

    return () => {
      io.disconnect();
      mq.removeEventListener("change", onMq);
      scene.destroy();
      sceneRef.current = null;
    };
  }, [slots, go, openPanel, closePanel]);

  useEffect(() => sceneRef.current?.setScroll(local), [local]);
  useEffect(() => sceneRef.current?.setSelected(selected), [selected]);
  useEffect(() => sceneRef.current?.setFocus(focus), [focus]);
  useEffect(() => sceneRef.current?.setActiveKey(active), [active]);
  useEffect(() => sceneRef.current?.setPaused(paused), [paused]);
  useEffect(() => sceneRef.current?.setCinema(cinema), [cinema]);

  // Esc 로 패널을 닫는다
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        labelRefs.current[selected]?.focus({ preventScroll: true });
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closePanel]);

  const current = mobile ? focus : selected;

  return (
    <div ref={hostRef} className="relative h-full w-full select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
        aria-label="행성계. 끌어서 시점을 바꾸고, 행성이나 위성을 눌러 정보를 여세요. 아래 버튼으로도 고를 수 있습니다."
        role="img"
      />

      {/*
        패널 내용(테마 · 모드 · 한 줄)을 글로 — 패널은 행성을 눌러야 그려져서 서버 HTML 에 없었다(2026-11-09).
        화면 낭독기는 장면이 그림 한 장이라 이 목록으로 바로 들어가고, 검색엔진 · AI 도 이걸 읽는다.
        눈에 보이는 내용은 패널과 같다 — 여기에만 있는 문구를 넣지 않는다(숨긴 글로 순위를 올리는 것처럼 보인다).
      */}
      <nav aria-label="테마 바로가기" className="sr-only">
        <ul>
          {slots.map((s) =>
            s.kind === "theme" && !s.theme.is_locked ? (
              <li key={s.theme.id}>
                <Link href={`/themes/${s.theme.slug}`} prefetch={false}>
                  {s.theme.name}
                </Link>
                {(s.theme.orbits ?? []).length > 0 && (
                  <ul>
                    {(s.theme.orbits ?? []).map((o) => (
                      <li key={o.key}>
                        <Link href={o.href} prefetch={false}>
                          {o.label}
                        </Link>{" "}
                        {o.spec}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ) : null
          )}
        </ul>
      </nav>

      {/* 행성 이름표 — 장면이 매 프레임 위치를 옮긴다. 키보드로 행성을 고르는 길이기도 하다. */}
      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        {slots.map((s, i) => {
          const theme = s.kind === "theme" ? s.theme : null;
          const locked = !theme || theme.is_locked;
          const accent = theme?.accent_color || DEFAULT_ACCENT;
          return (
            <button
              key={theme?.id ?? "soon"}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              type="button"
              onClick={() => openPanel(i)}
              data-track={`홈 행성 이름표 → ${theme?.name ?? "출시 예정"}`}
              className="pointer-events-auto absolute left-0 top-0 border-l border-line px-3 py-1.5 text-left transition-colors hover:border-line-strong"
              style={{ transform: "translate(-9999px, 0)" }}
            >
              <span className="block font-mono text-micro tracking-[0.2em] text-muted">
                PLANET {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`block font-semibold ${locked ? "text-label text-muted" : "text-h3"}`}
                style={{ color: locked ? undefined : accent }}
              >
                {theme?.name ?? "???"}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-micro text-muted">
                {locked ? (
                  "미탐사 구역"
                ) : (
                  <>
                    {(theme?.orbits ?? []).map((o) => (
                      <span key={o.key} aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} />
                    ))}
                    <span className="ml-0.5">탐사 가능</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 넓은 화면 — 오른쪽 브리핑 패널 */}
      <div
        className={`absolute right-[5%] top-1/2 hidden w-[28rem] -translate-y-1/2 sm:block ${
          selected === null ? "pointer-events-none" : ""
        }`}
        inert={selected === null || closing}
      >
        {selected !== null && !mobile && (
          <PlanetPanel
            key={selected}
            slot={slots[selected]}
            index={selected}
            variant="side"
            active={active}
            onActive={setActive}
            onClose={closePanel}
            closing={closing}
          />
        )}
      </div>

      {/* 휴대폰 — 행성 넘기기 + 아래 패널 */}
      {mobile && current !== null && (
        <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3">
          <div className="flex items-center justify-center gap-4">
            <SpaceControls.Reset
              onReset={() => {
                setCinema(false);
                sceneRef.current?.reset();
              }}
            />
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={focus === 0}
              aria-label="이전 행성"
              data-track="홈 행성 이전"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-background/70 disabled:opacity-30"
            >
              <Chevron dir="left" className="h-4 w-4" />
            </button>
            <p className="font-mono text-micro tracking-[0.2em] text-muted" aria-live="polite">
              {String(focus + 1).padStart(2, "0")} / {String(slots.length).padStart(2, "0")}
            </p>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={focus === slots.length - 1}
              aria-label="다음 행성"
              data-track="홈 행성 다음"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-background/70 disabled:opacity-30"
            >
              <Chevron dir="right" className="h-4 w-4" />
            </button>
            <SpaceControls.Pause paused={paused} onPause={() => setPaused((p) => !p)} />
          </div>
          <PlanetPanel
            key={focus}
            slot={slots[focus]}
            index={focus}
            variant="sheet"
            active={active}
            onActive={setActive}
          />
        </div>
      )}

      {/* 휴대폰은 넘기기 줄 양옆에 처음 시점 · 멈춤만 둔다. 확대는 손가락 두 개가 페이지 확대와 겹쳐서 뺐다. */}
      {!mobile && (
        <SpaceControls
          paused={paused}
          cinema={cinema}
          onZoom={(d) => sceneRef.current?.zoomBy(d)}
          onReset={() => {
            setCinema(false);
            sceneRef.current?.reset();
          }}
          onPause={() => setPaused((p) => !p)}
          onCinema={() => setCinema((c) => !c)}
        />
      )}

      {!mobile && (
        <p className="pointer-events-none absolute bottom-6 left-[5%] text-micro leading-relaxed text-muted">
          <span className="font-mono tracking-[0.2em] text-white">DRAG</span> 시점 이동
          <span className="mx-2 text-line">/</span>
          행성을 눌러 가까이 다가가세요
        </p>
      )}
    </div>
  );
}
