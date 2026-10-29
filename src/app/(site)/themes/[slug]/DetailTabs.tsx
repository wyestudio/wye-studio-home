"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { scrollToScreen, stickyEdge } from "./screenScroll";

/**
 * 모바일 전용 섹션 이동 탭.
 *
 * 모바일에서는 회차 선택 · 상세 정보 · 후기가 한 화면에 같이 안 들어간다.
 * 네이버 예약처럼 상단에 탭을 두고 눌러서 오가게 한다.
 * 테마 소개는 맨 위라 탭이 없어도 바로 보인다 — 그 자리를 후기에 내줬다(2026-10-29 대표님).
 *
 * ⚠️ 헤더 바로 아래에 붙어야 해서 헤더가 노출하는 --header-height 를 쓴다.
 *    숫자를 직접 박으면 헤더 높이가 바뀔 때마다 어긋난다.
 * ⚠️ 후기(sec-reviews)는 상세 정보(#detail) **안에** 있는 블록이다(어드민 블록 순서에 따라 위치가
 *    바뀐다). 그래서 지금 탭은 겹침 감시가 아니라 스크롤 위치로 고른다 — 후기 구간에서만 '후기',
 *    그 위·아래 블록은 '상세 정보'. 후기 블록이 없는 테마·모드는 후기 탭을 뺀다.
 */
const TABS = [
  { id: "booking", label: "회차 선택" },
  { id: "detail", label: "상세 정보" },
  // id 는 ThemeBlocks 가 영문 라벨(REVIEWS)로 짓는 섹션 id 다.
  { id: "sec-reviews", label: "후기" },
];

const REVIEWS = "sec-reviews";

export function DetailTabs({ accent }: { accent: string }) {
  const [active, setActive] = useState("booking");
  const [hasReviews, setHasReviews] = useState(false);
  // 모드를 바꾸면 주소만 바뀌고 이 탭은 그대로 남는다 — 그때 후기 블록 유무를 다시 본다.
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setHasReviews(document.getElementById(REVIEWS) !== null);
      // 기준선: 붙어 있는 헤더·탭 아래끝에서 화면 높이의 20% 더 내려간 곳.
      const line = stickyEdge().bottom + window.innerHeight * 0.2;
      const reviews = document.getElementById(REVIEWS)?.getBoundingClientRect();
      if (reviews && reviews.top <= line && reviews.bottom > line) {
        setActive(REVIEWS);
        return;
      }
      const detail = document.getElementById("detail")?.getBoundingClientRect();
      setActive(detail && detail.top <= line ? "detail" : "booking");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  const tabs = hasReviews ? TABS : TABS.filter((t) => t.id !== REVIEWS);

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
      {tabs.map((t) => {
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
