"use client";

import Link from "next/link";
import { useRef } from "react";

import { Chevron } from "@/components/ui/Chevron";

// 호버 시 커서가 들어온 지점에서 흰 원이 퍼지며 배경이 하얗게 뒤집히는 연출
// (21st.dev "Origin Button" 참고) — --origin-x/y를 진입 지점으로 세팅해두면
// CSS transition이 그 점을 중심으로 원을 확대한다.
function handlePointerEnter(e: React.PointerEvent<HTMLAnchorElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--origin-x", `${e.clientX - rect.left}px`);
  el.style.setProperty("--origin-y", `${e.clientY - rect.top}px`);
}

export function HeroCtaButton() {
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <Link
      ref={ref}
      href="/contents"
      onPointerEnter={handlePointerEnter}
      // ⚠️ lg 에서 키우는 폭은 조금만. 호버 때 퍼지는 흰 원(globals.css .hero-cta-fill)이
      //    지름 340px 고정이라, 버튼이 너무 커지면 반대편 모서리가 덜 덮인다.
      className="hero-cta-button pointer-events-auto relative inline-flex items-center py-[13px] pl-10 pr-[55px] text-[1.1rem] font-semibold tracking-wide text-white lg:py-[15px] lg:text-[1.25rem]"
    >
      <span aria-hidden className="hero-cta-fill" />
      <span className="hero-cta-label-default relative z-10 inline-flex items-center gap-4">
        <Chevron dir="right" className="h-4 w-4" />
        YES
      </span>
      {/* 호버 라벨은 왼쪽 정렬된 기본 라벨과 별개로 버튼 전체 폭 기준 정중앙에 오게
          absolute + inset-0으로 독립시킨다(기본 라벨의 비대칭 패딩에 안 끌려가게). */}
      <span
        aria-hidden
        className="hero-cta-label-hover absolute inset-0 z-10 flex items-center justify-center"
      >
        참여하기
      </span>
    </Link>
  );
}
