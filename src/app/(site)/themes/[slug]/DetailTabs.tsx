"use client";

import { useEffect, useState } from "react";
import { scrollToScreen } from "./screenScroll";

/**
 * 모바일 전용 섹션 이동 탭.
 *
 * 모바일에서는 테마 소개 · 회차 선택 · 상세 설명이 한 화면에 같이 안 들어간다.
 * 네이버 예약처럼 상단에 탭을 두고 눌러서 오가게 한다.
 *
 * ⚠️ 헤더 바로 아래에 붙어야 해서 헤더가 노출하는 --header-height 를 쓴다.
 *    숫자를 직접 박으면 헤더 높이가 바뀔 때마다 어긋난다.
 */
const TABS = [
  { id: "intro", label: "테마 소개" },
  { id: "booking", label: "회차 선택" },
  { id: "detail", label: "상세 정보" },
];

export function DetailTabs({ accent }: { accent: string }) {
  const [active, setActive] = useState("intro");

  useEffect(() => {
    const sections = TABS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;

    // 화면 위쪽에 걸린 섹션을 현재 탭으로 본다.
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting);
        if (shown.length > 0) setActive(shown[shown.length - 1].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    /*
      ⚠️ z 는 헤더(z-20)보다 낮게. before 로 위쪽을 배경으로 채워두면
         --header-height 가 실제 헤더 높이와 1~2px 어긋나도 그 틈으로 본문이
         비쳐 보이지 않는다. 겹치는 부분은 헤더가 위에서 덮는다.
    */
    <nav
      /*
        ⚠️ **xl:hidden 이다. SectionNav 의 `xl:block` 과 짝이다 — 둘을 같은
           경계에 두지 않으면 어느 한쪽도 없는 구간이 생긴다.**
           전에는 sm:hidden 이라 640~1279px 에서 섹션 이동 수단이 아예 없었다
           (9,000px 짜리 상세를 통째로 스크롤해야 했다, 2026-10-08 실측).
           고치면서 lg:hidden 으로 뒀더니 공백이 1024~1279 로 옮겨갔을 뿐이었다.
           목차를 lg 로 내리는 방법도 있었지만 SectionNav 는 `fixed left-6` 이라
           1024px 창에서 본문 위에 겹친다 — 그래서 탭 쪽을 xl 까지 넓혔다.
      */
      className="sticky top-[var(--header-height,64px)] z-10 -mx-5 mb-2 flex border-b border-line-subtle bg-background
                 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-24 before:bg-background
                 transition-transform duration-300 ease-out
                 [html[data-header-hidden]_&]:-translate-y-[var(--header-height,64px)]
                 sm:justify-center xl:hidden"
      aria-label="섹션 이동"
    >
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <a
            key={t.id}
            href={`#${t.id}`}
            onClick={(e) => {
              const el = document.getElementById(t.id);
              if (!el) return;
              // 헤더가 스크롤 방향에 따라 숨으므로 도착 위치를 직접 계산한다(screenScroll.ts).
              // 링크 기본 이동(scroll-mt)에 맡기면 아래로 갈 때 헤더 높이만큼 빈 띠가 남는다.
              e.preventDefault();
              setActive(t.id);
              scrollToScreen(el);
            }}
            className={`flex-1 border-b-2 py-3 text-center text-body-sm font-semibold transition-colors sm:min-w-[10rem] sm:flex-none ${
              on ? "" : "border-transparent text-muted"
            }`}
            style={on ? { borderColor: accent, color: accent } : undefined}
          >
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
