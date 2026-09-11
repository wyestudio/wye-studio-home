"use client";

import { useEffect, useState } from "react";

/**
 * 모바일 전용 섹션 이동 탭.
 *
 * 모바일에서는 회차 선택과 상세 설명이 한 화면에 같이 안 들어간다.
 * 네이버 예약처럼 상단에 탭을 두고 눌러서 오가게 한다.
 *
 * ⚠️ 헤더 바로 아래에 붙어야 해서 헤더가 노출하는 --header-height 를 쓴다.
 *    숫자를 직접 박으면 헤더 높이가 바뀔 때마다 어긋난다.
 */
const TABS = [
  { id: "booking", label: "회차 선택" },
  { id: "detail", label: "상세 정보" },
];

export function DetailTabs({ accent }: { accent: string }) {
  const [active, setActive] = useState("booking");

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
      className="sticky top-[var(--header-height,52px)] z-10 -mx-5 mb-2 flex border-b border-white/10 bg-background
                 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-24 before:bg-background
                 sm:hidden"
      aria-label="섹션 이동"
    >
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <a
            key={t.id}
            href={`#${t.id}`}
            onClick={() => setActive(t.id)}
            className={`flex-1 border-b-2 py-3 text-center text-sm font-bold transition-colors ${
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
