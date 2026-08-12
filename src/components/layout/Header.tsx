"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { RandomLetterSwap } from "@/components/ui/RandomLetterSwap";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인/계정 네비게이션은
// 제거함. 로그인 시스템 자체는 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
export function Header() {
  const headerRef = useRef<HTMLElement>(null);

  // 실제 렌더된 헤더 높이를 CSS 변수로 노출 — 홈 히어로의 스크롤 스테이지가 이 값만큼
  // 음수 마진을 줘서, 헤더 아래로 스크롤이 다 지나가야 스크롤텔링이 시작되는 "빈 스크롤
  // 구간" 없이 처음 스크롤부터 바로 고정+페이드가 시작되도록 함.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    function setHeaderHeightVar() {
      document.documentElement.style.setProperty("--header-height", `${el!.offsetHeight}px`);
    }
    setHeaderHeightVar();
    const resizeObserver = new ResizeObserver(setHeaderHeightVar);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-4">
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5">
            <Image
              src="/logo-white.png"
              alt=""
              width={92}
              height={64}
              priority
              className="h-7 w-auto"
            />
            <span className="whitespace-nowrap text-base font-extrabold tracking-tight text-foreground">
              우주이스케이프
            </span>
          </Link>
          <div className="relative hidden sm:block" aria-hidden>
            <span className="animate-hammer-swing absolute -left-2 -top-1.5 text-sm">
              🔨
            </span>
            <Image
              src="/mascot-kape.png"
              alt=""
              width={36}
              height={26}
              className="animate-mascot-bob"
            />
          </div>
          <Badge tone="confirm">BETA</Badge>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <Link href="/about">
            <RandomLetterSwap label="About" className="hover:text-glow" />
          </Link>
          <Link href="/contents">
            <RandomLetterSwap label="Contents" className="hover:text-glow" />
          </Link>
          <Link href="/lookup">
            <RandomLetterSwap label="Check" className="hover:text-glow" />
          </Link>
          <Link href="/notice">
            <RandomLetterSwap label="Notice" className="hover:text-glow" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
