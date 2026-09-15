"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RandomLetterSwap } from "@/components/ui/RandomLetterSwap";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인/계정 네비게이션은
// 제거함. 로그인 시스템 자체는 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  // 테마 상세(/themes/[slug])에서만 모바일 헤더를 스크롤 방향에 따라 숨긴다.
  const autoHide = /^\/themes\/[^/]+\/?$/.test(pathname);

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

  /*
    모바일 테마 상세: 내리면 헤더를 숨기고, 올리면 다시 보인다 — 휴대폰 브라우저 주소창과
    같은 방식(2026-09-15 요청). 헤더 + 섹션 이동 탭(DetailTabs)이 같이 붙어 있어 위가
    너무 두꺼워 답답하다는 의견. 탭은 헤더가 숨으면 맨 위로 따라 올라간다.

    상태는 <html data-header-hidden> 하나로 알린다. 헤더·탭·스크롤 계산(screenScroll.ts)이
    같은 표시를 본다. ⚠️ 데스크톱(768px 이상)에서는 절대 숨기지 않는다.
  */
  useEffect(() => {
    const root = document.documentElement;
    if (!autoHide || isMenuOpen) {
      root.removeAttribute("data-header-hidden");
      return;
    }
    const mobile = window.matchMedia("(max-width: 767px)");
    // 이 위(헤더 + 탭 높이 정도)에서는 숨기지 않는다. screenScroll.ts 의 HEADER_REVEAL_ZONE 과 같은 값.
    const REVEAL_ZONE = 120;
    // 손가락 떨림으로 깜빡이지 않게, 이만큼 한 방향으로 움직여야 바꾼다.
    const THRESHOLD = 8;
    let anchorY = window.scrollY;
    let raf = 0;

    const update = () => {
      const y = Math.max(0, window.scrollY);
      if (!mobile.matches || y < REVEAL_ZONE) {
        root.removeAttribute("data-header-hidden");
        anchorY = y;
        return;
      }
      const dy = y - anchorY;
      if (dy > THRESHOLD) {
        root.setAttribute("data-header-hidden", "");
        anchorY = y;
      } else if (dy < -THRESHOLD) {
        root.removeAttribute("data-header-hidden");
        anchorY = y;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    mobile.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      mobile.removeEventListener("change", update);
      root.removeAttribute("data-header-hidden");
    };
  }, [autoHide, isMenuOpen]);

  const navItems = [
    { label: "About", href: "/about", enabled: process.env.NEXT_PUBLIC_ABOUT_ENABLED === "true" },
    { label: "Contents", href: "/contents" },
    { label: "Check", href: "/lookup" },
    { label: "Notice", href: "/notice" },
  ];

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 transition-transform duration-300 ease-out max-md:[html[data-header-hidden]_&]:-translate-y-full"
    >
      {/* 데스크톱 헤더 */}
      {/*
        크기(2026-09-15 키움): 테마 상세 첫 화면을 크게 세우고 나니 헤더가 작고 위에 붙어
        보였다. 로고·글자·메뉴와 위아래 여백을 한 단계씩 키웠다(높이 약 84 → 100px).
        ⚠️ 높이를 바꾸면 components/contents/screenSection.ts 의 숫자도 같이 고칠 것.
      */}
      <div className={`hidden md:flex mx-auto max-w-5xl items-center justify-between gap-2 px-5 py-7 ${isHome ? "bg-transparent" : "bg-background/95 backdrop-blur-md"}`}>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5">
            <Image
              src="/logo-white.png"
              alt=""
              width={92}
              height={64}
              priority
              className="h-11 w-auto"
            />
            <span className="whitespace-nowrap text-xl font-extrabold tracking-tight text-foreground">
              우주이스케이프
            </span>
          </Link>
        </div>
        {/* 데스크톱 네비게이션 */}
        <nav className="flex flex-wrap items-center gap-x-7 gap-y-1 text-lg font-bold text-muted">
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-4">
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-1.5">
              <Image
                src="/logo-white.png"
                alt=""
                width={92}
                height={64}
                priority
                className="h-8 w-auto"
              />
              <span className="whitespace-nowrap text-base font-extrabold tracking-tight text-foreground">
                우주이스케이프
              </span>
            </Link>
            </div>
          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex flex-col gap-1.5 focus:outline-none"
            aria-label="메뉴"
          >
            <div className={`h-0.5 w-6 bg-foreground transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`h-0.5 w-6 bg-foreground transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`h-0.5 w-6 bg-foreground transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
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
