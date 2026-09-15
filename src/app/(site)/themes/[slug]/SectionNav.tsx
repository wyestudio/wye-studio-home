"use client";

import { useEffect, useState } from "react";
import { scrollToScreen, stickyEdge } from "./screenScroll";

/**
 * 넓은 화면 왼쪽의 목차. 지금 보는 블록을 표시하고, 누르면 그 블록으로 넘어간다.
 *
 * 왜 (2026-09-15)
 *   블록이 화면에 딱 맞지 않은 자리에서는 '지금 어디쯤인지' 감이 안 온다는 의견.
 *
 * 모양
 *   우주선 조종석 계기판(HUD) 느낌 — 빛나는 마름모 표시, 궤도선, 모서리 괄호.
 *   풀페이지 사이트의 점 목차(fullPage.js 류)처럼 평소에는 **표시만 세로로** 두고,
 *   마우스를 올리면 판이 펼쳐지며 번호와 블록 이름이 나온다.
 *
 * 2026-09-16 고침
 *   - 늘 펼쳐 두었더니 공간을 많이 먹어 화면이 답답하다 → 평소엔 표시만, 올리면 전체.
 *   - 영문 라벨(FOR YOU · PRICE…)만 있어 읽기 불편하다 → 블록의 한글 제목을 보여준다.
 *
 * ⚠️ 펼치기는 hover 에 더해 focus-within 으로도 된다(키보드로 목차에 들어왔을 때).
 * ⚠️ 펼쳐도 줄 높이는 그대로다. 높이가 바뀌면 화면 가운데 맞춘 목차가 위아래로 움직인다.
 *
 * 블록 목록은 화면 블록([data-screen])의 data-nav-label 에서 읽는다.
 * 모바일은 상단 탭(DetailTabs)이 같은 일을 한다.
 */

type Item = { el: HTMLElement; label: string };

export function SectionNav({ accent }: { accent: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-screen][data-nav-label]")];
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
    // 목록은 서버가 그린 블록에서 읽으므로 화면이 뜬 직후에 채운다.
    // ⚠️ requestAnimationFrame 으로 채우지 않는다. 백그라운드 탭(새 탭으로 열기)에서는
    //    프레임 콜백이 멈춰 목차가 비어 있다(자동화 브라우저에서 실제로 그랬다).
    const init = window.setTimeout(() => {
      setItems(els.map((el) => ({ el, label: el.dataset.navLabel ?? "" })));
      update();
    }, 0);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(init);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (items.length < 2) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  /** 펼쳤을 때만 보이는 것 — 폭이 0 에서 늘어나며 나타난다. */
  const reveal =
    "max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-300 ease-out " +
    "group-hover/nav:max-w-[14rem] group-hover/nav:opacity-100 " +
    "group-focus-within/nav:max-w-[14rem] group-focus-within/nav:opacity-100";
  const panelOn =
    "group-hover/nav:border-white/10 group-hover/nav:bg-background/90 group-hover/nav:backdrop-blur-md " +
    "group-focus-within/nav:border-white/10 group-focus-within/nav:bg-background/90 group-focus-within/nav:backdrop-blur-md";

  return (
    <nav
      aria-label="상세 목차"
      className="group/nav fixed top-1/2 z-30 hidden -translate-y-1/2 xl:block
                 left-[max(0.5rem,calc((100vw-64rem)/2-3.5rem))]"
    >
      <div
        className={`relative rounded-md border border-transparent px-2.5 py-2 transition-[background-color,border-color] duration-300 ${panelOn}`}
      >
        {/* 모서리 괄호 — 펼쳤을 때만. 조종석 화면 테두리 느낌 */}
        <Corner className="left-0 top-0 border-l border-t" accent={accent} />
        <Corner className="right-0 top-0 border-r border-t" accent={accent} />
        <Corner className="bottom-0 left-0 border-b border-l" accent={accent} />
        <Corner className="bottom-0 right-0 border-b border-r" accent={accent} />

        <ol>
          {items.map((item, i) => {
            const on = i === active;
            const passed = i < active;
            return (
              <li key={i} className="relative">
                {/* 다음 항목까지 잇는 궤도선. 지나온 구간은 강조색. 표시(◆) 가운데에 맞춘다. */}
                {i < items.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[calc(0.375rem-0.5px)] top-1/2 h-full w-px transition-colors duration-500"
                    style={{
                      backgroundColor: passed ? `${accent}b3` : on ? `${accent}40` : "rgba(255,255,255,0.12)",
                      boxShadow: passed ? `0 0 6px ${accent}66` : undefined,
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => scrollToScreen(item.el)}
                  aria-current={on ? "true" : undefined}
                  aria-label={item.label}
                  className="group/item relative flex h-7 w-full items-center text-left"
                >
                  {/* 표시: 지나온 곳은 옅게 채운 마름모, 지금 곳은 빛나는 큰 마름모 */}
                  <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                    <span
                      className={`block rotate-45 border transition-all duration-300 ${
                        on ? "h-2.5 w-2.5" : "h-1.5 w-1.5 group-hover/item:h-2 group-hover/item:w-2"
                      }`}
                      style={{
                        borderColor: on || passed ? accent : "rgba(255,255,255,0.4)",
                        backgroundColor: on ? accent : passed ? `${accent}66` : "var(--background)",
                        boxShadow: on ? `0 0 10px ${accent}, 0 0 2px ${accent}` : undefined,
                      }}
                    />
                  </span>

                  <span className={`flex items-center whitespace-nowrap ${reveal}`}>
                    <span
                      className={`ml-3 w-5 font-mono text-[10px] tabular-nums ${on ? "" : "text-white/35"}`}
                      style={on ? { color: accent } : undefined}
                    >
                      {pad(i + 1)}
                    </span>
                    <span
                      className={`max-w-[11.5rem] truncate pr-1 text-[13px] transition-colors ${
                        on ? "font-bold" : "font-medium text-white/60 group-hover/item:text-white"
                      }`}
                      style={on ? { color: accent, textShadow: `0 0 8px ${accent}66` } : undefined}
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
      className={`pointer-events-none absolute h-2.5 w-2.5 opacity-0 transition-opacity duration-300 group-hover/nav:opacity-100 group-focus-within/nav:opacity-100 ${className}`}
      style={{ borderColor: `${accent}99` }}
    />
  );
}
