"use client";

import { useEffect, useState } from "react";
import { scrollToScreen, stickyEdge } from "./screenScroll";

/**
 * 넓은 화면 왼쪽의 목차. 지금 보는 블록을 표시하고, 누르면 그 블록으로 넘어간다.
 *
 * 왜 (2026-09-15)
 *   휠 한 번에 블록 하나씩 넘기게 했더니, 블록이 화면에 딱 맞지 않은 자리에서는 휠이
 *   먹혔다 안 먹혔다 하는 것처럼 느껴져 '지금 어디쯤인지' 감이 안 온다는 의견.
 *
 * 모양
 *   우주선 조종석 계기판(HUD) 느낌 — 모서리 괄호, 고정폭 숫자, 진행 막대.
 *   풀페이지 사이트의 점 목차(fullPage.js 류)처럼 세로로 늘어놓되, 점 대신 번호와
 *   블록의 영문 라벨(FOR YOU · PRICE …)을 쓴다. 영문 라벨은 제목 위에 이미 쓰고 있는
 *   표기라 새 이름을 만들지 않았고, 짧아서 좁은 여백에 들어간다.
 *
 * 폭
 *   본문은 가운데 64rem. 목차가 들어갈 왼쪽 여백은 1280px 화면에서 약 130px, 1440px 에서
 *   약 210px 이다. 1440px 이상은 라벨까지 늘 보이고, 1280~1439px 은 번호·표시만 두었다가
 *   마우스를 올리면 라벨이 펼쳐진다(본문 위로 겹쳐 뜬다). 그보다 좁으면 안 띄운다.
 *   모바일은 상단 탭(DetailTabs)이 같은 일을 한다.
 *
 * 블록 목록은 화면 블록([data-screen])의 data-nav-code / data-nav-label 에서 읽는다.
 */

type Item = { el: HTMLElement; code: string; label: string };

export function SectionNav({ accent }: { accent: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-screen][data-nav-code]")];
    let raf = 0;
    const update = () => {
      const { bottom } = stickyEdge();
      const vh = window.innerHeight;
      // 헤더 밑에서 화면의 40% 지점에 걸친 블록을 '지금 블록' 으로 본다.
      // 윗끝 기준으로 보면 긴 블록(후기)을 읽는 중에 다음 블록으로 너무 일찍 넘어간다.
      const probe = bottom + (vh - bottom) * 0.4;
      let idx = 0;
      els.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= probe) idx = i;
      });
      // 맨 아래까지 내렸는데 마지막 블록이 짧아 기준선에 못 닿는 경우.
      if (window.scrollY + vh >= document.documentElement.scrollHeight - 4) idx = els.length - 1;
      setActive(idx);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    // 목록은 서버가 그린 블록에서 읽으므로 화면이 뜬 다음 프레임에 채운다.
    raf = requestAnimationFrame(() => {
      setItems(
        els.map((el) => ({
          el,
          code: el.dataset.navCode ?? "",
          label: el.dataset.navLabel ?? "",
        }))
      );
      update();
    });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (items.length < 2) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <nav
      aria-label="상세 목차"
      className="group/nav fixed top-1/2 z-30 hidden -translate-y-1/2 xl:block
                 left-[max(0.75rem,calc((100vw-64rem)/2-12.5rem))]"
    >
      <div
        className="relative rounded-md border border-white/10 bg-background/70 px-3 py-3 backdrop-blur-md
                   transition-[background-color,border-color] duration-300
                   max-[1439px]:border-transparent max-[1439px]:bg-transparent max-[1439px]:backdrop-blur-none
                   max-[1439px]:group-hover/nav:border-white/10 max-[1439px]:group-hover/nav:bg-background/85
                   max-[1439px]:group-hover/nav:backdrop-blur-md"
      >
        {/* 모서리 괄호 — 조종석 화면 테두리 느낌 */}
        <Corner className="left-0 top-0 border-l border-t" accent={accent} />
        <Corner className="right-0 top-0 border-r border-t" accent={accent} />
        <Corner className="bottom-0 left-0 border-b border-l" accent={accent} />
        <Corner className="bottom-0 right-0 border-b border-r" accent={accent} />

        {/* 머리줄: 이름 + 지금 위치 */}
        <div className="mb-2.5 flex items-center justify-between gap-3 font-mono text-[10px] tracking-[0.18em] text-white/40">
          <span className="max-[1439px]:hidden max-[1439px]:group-hover/nav:inline">NAV</span>
          <span className="tabular-nums" style={{ color: accent }}>
            {pad(active + 1)}
            <span className="text-white/30">/{pad(items.length)}</span>
          </span>
        </div>

        <ol>
          {items.map((item, i) => {
            const on = i === active;
            const passed = i < active;
            return (
              <li key={i} className="relative">
                {/*
                  다음 항목까지 잇는 궤도선. 지나온 구간은 강조색으로 채운다.
                  줄마다 높이가 같아야 선이 표시 가운데끼리 정확히 이어진다 — 그래서 한글
                  이름 줄은 지금 항목이 아니어도 자리를 차지한다(invisible).
                */}
                {i < items.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[calc(2rem-0.5px)] top-1/2 h-full w-px transition-colors duration-500"
                    style={{
                      backgroundColor: passed || on ? `${accent}${on ? "33" : "b3"}` : "rgba(255,255,255,0.1)",
                      boxShadow: passed ? `0 0 6px ${accent}66` : undefined,
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => scrollToScreen(item.el)}
                  aria-current={on ? "true" : undefined}
                  title={item.label}
                  className="group/item relative flex w-full items-center gap-2.5 py-[0.3rem] text-left"
                >
                  <span
                    className={`w-4 font-mono text-[10px] tabular-nums transition-colors ${
                      on ? "" : "text-white/30 group-hover/item:text-white/60"
                    }`}
                    style={on ? { color: accent } : undefined}
                  >
                    {pad(i + 1)}
                  </span>

                  {/* 표시: 지나온 곳은 채운 작은 마름모, 지금 곳은 빛나는 큰 마름모 */}
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span
                      className={`block rotate-45 border transition-all duration-300 ${
                        on ? "h-2.5 w-2.5" : "h-1.5 w-1.5 group-hover/item:h-2 group-hover/item:w-2"
                      }`}
                      style={{
                        borderColor: on || passed ? accent : "rgba(255,255,255,0.35)",
                        backgroundColor: on ? accent : passed ? `${accent}66` : "var(--background)",
                        boxShadow: on ? `0 0 10px ${accent}, 0 0 2px ${accent}` : undefined,
                      }}
                    />
                  </span>

                  <span
                    className="flex min-w-0 flex-col max-[1439px]:hidden max-[1439px]:group-hover/nav:flex"
                  >
                    <span
                      className={`whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                        on ? "" : "text-white/45 group-hover/item:text-white/80"
                      }`}
                      style={on ? { color: accent, textShadow: `0 0 8px ${accent}80` } : undefined}
                    >
                      {item.code}
                    </span>
                    <span
                      className={`max-w-[8.5rem] truncate text-[11px] leading-tight text-white/70 ${on ? "" : "invisible"}`}
                    >
                      {item.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function Corner({ className, accent }: { className: string; accent: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-2.5 w-2.5 ${className}`}
      style={{ borderColor: `${accent}99` }}
    />
  );
}
