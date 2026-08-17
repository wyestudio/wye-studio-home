"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { RandomLetterSwap } from "@/components/ui/RandomLetterSwap";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인/계정 네비게이션은
// 제거함. 로그인 시스템 자체는 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

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

  const navItems = [
    { label: "About", href: "/about", enabled: process.env.NEXT_PUBLIC_ABOUT_ENABLED === "true" },
    { label: "Contents", href: "/contents" },
    { label: "Check", href: "/lookup" },
    { label: "Notice", href: "/notice" },
  ];

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20"
    >
      {/* 데스크톱 헤더 */}
      <div className={`hidden md:flex mx-auto max-w-5xl items-center justify-between gap-2 px-5 py-6 ${isHome ? "bg-transparent" : "bg-background/95 backdrop-blur-md"}`}>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5">
            <Image
              src="/logo-white.png"
              alt=""
              width={92}
              height={64}
              priority
              className="h-9 w-auto"
            />
            <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-foreground">
              우주이스케이프
            </span>
          </Link>
          <Badge tone="confirm">PRE-OPEN</Badge>
        </div>
        {/* 데스크톱 네비게이션 */}
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-bold text-muted">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return item.enabled === false ? null : (
              <Link
                key={item.href}
                href={item.href}
                className={`pb-2.5 hover:text-glow transition-colors ${isActive ? 'border-b-2 border-glow' : ''}`}
              >
                <RandomLetterSwap label={item.label} active={isActive} />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 모바일 헤더 */}
      <div className="md:hidden bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-1.5">
              <Image
                src="/logo-white.png"
                alt=""
                width={92}
                height={64}
                priority
                className="h-7 w-auto"
              />
              <span className="whitespace-nowrap text-sm font-extrabold tracking-tight text-foreground">
                우주이스케이프
              </span>
            </Link>
            <Badge tone="confirm">PRE-OPEN</Badge>
          </div>
          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col gap-1 focus:outline-none"
            aria-label="메뉴"
          >
            <div className={`h-0.5 w-5 bg-foreground transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`h-0.5 w-5 bg-foreground transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`h-0.5 w-5 bg-foreground transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {isMenuOpen && (
          <div className="border-t border-border bg-background">
            <div className="mx-auto max-w-5xl px-5 py-3">
              {/* 영문 메뉴 */}
              <nav className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-base font-bold text-muted">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return item.enabled === false ? null : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`pb-2.5 hover:text-glow transition-colors ${isActive ? 'border-b-2 border-glow' : ''}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
