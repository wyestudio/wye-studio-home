"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ThemeDetail } from "@/lib/themes";
import { modeHref } from "./ModeBox";

/**
 * 스크롤을 따라다니는 모드 전환 패드 — 게임의 장착 상태창 자리.
 *
 * 왜 떠 있는가
 *   가격·회차·인원이 전부 모드에 따라 달라서, 아래로 내려갈수록 "지금 어느 쪽
 *   숫자를 보고 있는지" 가 흐려진다. 예전에는 회차 선택 위와 가격표 위에 전환
 *   토글을 **따로따로** 박아 뒀는데, 블록이 늘 때마다 또 박아야 했다.
 *
 * ⚠️ 자리는 **화면 아래 가운데**다. 이 페이지에서 비어 있는 유일한 자리다 —
 *    위는 헤더와 섹션 탭, 왼쪽은 목차 레일, 오른쪽 아래는 인스타·카카오 버튼이
 *    이미 차지하고 있다(2026-10-09 실측).
 * ⚠️ 모바일에서 하단 신청 막대가 뜨면 그만큼 올라간다 — globals.css 의
 *    `body:has(.mobile-cta-bar) .mode-hud` 가 맡는다. 카카오 버튼이 쓰던 방법과 같다.
 *
 * ⚠️ 전환할 때 **지금 보고 있는 섹션으로 돌아간다.** 두 모드는 문서 길이가 다르다
 *    (파티는 상세블록이 있고 노말은 없다). 스크롤 위치(px)를 그대로 두면 전혀 다른
 *    자리에 떨어진다 — 실제로 가격표에서 눌렀더니 '이런 분께 추천' 한가운데로
 *    갔었다. 그래서 화면 한가운데를 지나는 섹션의 id 를 주소에 달아 보낸다.
 */
export function ModeHud({
  variants,
  activeId,
  baseSlug,
  accent,
}: {
  variants: ThemeDetail[];
  activeId: string;
  baseSlug: string;
  accent: string;
}) {
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    /*
      ⚠️ `[data-screen][id]` 로 좁히면 안 된다. 상세의 **콘텐츠 블록들은
         data-screen 만 있고 id 가 없어서** 통째로 빠지고, 그러면 후기를 보고
         있는데도 마지막으로 걸린 '회차 선택' 으로 돌아간다(2026-10-09 실측).
         id 가 없는 블록은 그 블록을 감싸는 섹션(#detail)으로 보낸다.
    */
    const screens = Array.from(document.querySelectorAll<HTMLElement>("[data-screen]"))
      .map((el) => ({ el, id: el.id || el.parentElement?.closest("[id]")?.id || "" }))
      .filter((s) => s.id !== "");
    if (screens.length === 0) return;

    const idOf = new Map(screens.map((s) => [s.el, s.id]));

    /*
      위아래를 50% 씩 깎으면 **화면 한가운데 선을 지나는 요소만** 걸린다.
      스크롤 이벤트를 직접 듣는 것보다 싸고, 관성 스크롤에서도 안 튄다.
    */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = idOf.get(e.target as HTMLElement);
          if (id) setSection(id);
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    screens.forEach((s) => io.observe(s.el));
    return () => io.disconnect();
  }, []);

  // 소개 섹션을 보고 있는 동안에는 안 띄운다 — 바로 위에 모드 창이 있다.
  const shown = section !== null && section !== "intro-screen";
  if (variants.length < 2) return null;

  return (
    /*
      ⚠️ `left-1/2 -translate-x-1/2` 로 가운데를 맞추지 말 것. fixed 요소의 기준은
         화면이라 `left:50%` 이면 **쓸 수 있는 폭이 화면의 절반**으로 묶인다 —
         390px 화면에서 195px 밖에 못 써서 화살표가 모드 이름 위로 꺾였다
         (2026-10-09 실측). 가로를 꽉 채우고 flex 로 가운데를 맞춘다.
      ⚠️ 그래서 바깥 칸은 클릭을 안 받는다(pointer-events-none). 안 그러면 투명한
         띠가 본문 위를 덮어 그 줄의 글자를 못 누른다.
    */
    <div
      className={`mode-hud pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 transition-opacity duration-200 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        role="group"
        aria-label="모드 전환"
        aria-hidden={!shown}
        className={`flex w-fit items-center gap-1.5 rounded-lg border-2 bg-surface/90 p-1.5 backdrop-blur sm:gap-2 sm:px-2 ${
          shown ? "pointer-events-auto" : ""
        }`}
        style={{ borderColor: accent, boxShadow: `0 3px 0 ${accent}59` }}
      >
        <span
          aria-hidden
          className="hidden shrink-0 pl-1 font-galmuri text-micro tracking-[0.12em] sm:inline"
          style={{ color: accent }}
        >
          ◆ MODE
        </span>
        {variants.map((v) => {
          const on = v.id === activeId;
          const c = v.accent_color || accent;
          return (
            <Link
              key={v.id}
              // 지금 보고 있는 섹션으로 돌아간다(위 주석 참고).
              href={section ? `${modeHref(baseSlug, variants, v)}#${section}` : modeHref(baseSlug, variants, v)}
              aria-current={on ? "true" : undefined}
              tabIndex={shown ? undefined : -1}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 font-galmuri text-label transition-colors duration-150 ${
                on ? "" : "text-muted hover:text-foreground"
              }`}
              style={on ? { backgroundColor: c, color: "#0a0a12" } : undefined}
            >
              <span aria-hidden className="mr-1">{on ? "▶" : "▷"}</span>
              {v.variant_label ?? v.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
