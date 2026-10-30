"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RandomLetterSwap } from "@/components/ui/RandomLetterSwap";
import { SeasonArt } from "@/components/season/SeasonArt";
import { ADMIN_MENU, ADMIN_QUICK, isAdminMenuActive } from "@/components/admin/adminMenu";
import { LogoutButton } from "@/components/admin/LogoutButton";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인/계정 네비게이션은
// 제거함. 로그인 시스템 자체는 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
/**
 * @param admin 어드민 호스트(admin.*)에서 그릴 때 — 고객 메뉴(소개 · 테마 · 신청조회 · 공지) 대신
 *   어드민 메뉴를 단다. 고객 메뉴가 그대로 있으면 운영자가 자꾸 그걸 눌렀다(2026-10-30 대표님).
 *   판단은 레이아웃이 호스트로 한다 — 어드민 주소는 rewrite 라 경로만으로는 모른다.
 */
export function Header({ admin = false }: { admin?: boolean }) {
  const headerRef = useRef<HTMLElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  /*
    모바일 헤더를 스크롤 방향에 따라 숨기는 화면.
      /themes/[slug]       테마 상세 — 길어서 위가 답답했다(2026-09-15)
      /themes/[slug]/apply 신청 — 헤더 + 3단계 스테퍼가 겹쳐 화면이 꽉 찼다(2026-10-05)
    ⚠️ 두 화면 모두 위에 sticky 줄(DetailTabs · ApplyStepper)이 하나 더 붙어 있다.
       그 줄들은 html[data-header-hidden] 을 보고 헤더 자리만큼 따라 올라간다.
  */
  const autoHide = /^\/themes\/[^/]+(\/apply)?\/?$/.test(pathname);

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
    헤더 아래 선이 화면에서 지금 몇 px 에 있는지(--header-bottom).
    시즌 배경 장식(거미줄·달)을 이 선에 붙인다(season.css). 높이(--header-height)만으로는
    모자란다 — 테스트 배너가 위에 있으면 헤더가 그만큼 내려와 있고, 스크롤하면 붙어
    올라가고, 모바일 테마 상세에서는 헤더가 숨는다.
  */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      root.style.setProperty("--header-bottom", `${Math.max(0, Math.round(el.getBoundingClientRect().bottom))}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // 숨김/보임 전환(translate)은 스크롤이 멈춘 뒤에도 300ms 움직인다.
    el.addEventListener("transitionend", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.removeEventListener("transitionend", schedule);
    };
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

  /*
    메뉴 이름은 **한국어**다(2026-10-05). 영문(Contents·Check·Notice)일 때는
    'Check' 가 신청내역 조회라는 걸 추측해야 했다 — 눌렀을 때 무엇이 나오는지
    이름만 보고 알 수 있어야 한다(UX 진단 H2).

    ⚠️ 짧게 둔다. 좁은 화면에서 네 개가 한 줄에 들어가야 한다.
    ⚠️ '예약조회' 가 아니라 **'신청조회'** 다. 개인 흐름은 전부 '신청' 으로 쓴다
       (신청하기 · 참여 신청 · 신청내역 조회). '예약' 은 **단체 예약**과
       **노말모드**(우리 팀만 방을 잡는다, themes.booking_verb)에만 쓴다. 메뉴는
       두 모드 공통이라 '신청조회' 그대로 둔다.
  */
  const navItems = [
    { label: "소개", href: "/about", enabled: process.env.NEXT_PUBLIC_ABOUT_ENABLED === "true" },
    { label: "테마", href: "/contents" },
    { label: "신청조회", href: "/lookup" },
    { label: "공지", href: "/notice" },
  ];

  return (
    <header
      ref={headerRef}
      // site-header — 시즌 스킨(season.css)이 배경·아래 경계선을 단다. 홈은 투명 그대로.
      data-home={isHome ? "" : undefined}
      className="site-header sticky top-0 z-20 transition-transform duration-300 ease-out max-md:[html[data-header-hidden]_&]:-translate-y-full"
    >
      {/* 데스크톱 헤더 */}
      {/*
        크기: **72px** (여백 16 + 로고 40 + 여백 16).

        2026-09-15 에 84 → 100px 로 키웠었다. 이유는 "테마 상세 첫 화면을 크게 세우고
        나니 헤더가 작고 위에 붙어 보여서" 였는데, 2026-10-05 에 그 첫 화면을 다시
        줄였다(810 → 672px). **전제가 사라져서** 2026-10-07 에 72px 로 되돌린다 —
        100px 는 1280×800 화면에서 세로의 12.5% 를 머리말이 가져가는 크기였다.

        ⚠️ 높이를 바꾸면 **같이 고칠 곳**:
           - components/contents/screenSection.ts 의 SCREEN_SCROLL_MARGIN
           - DetailTabs.tsx · ScrollStage.tsx 의 var(--header-height) **기본값**
           (var(--header-height) 를 그대로 쓰는 곳은 아래 useEffect 가 실측해 넣으므로
            따라온다 — 기본값만 JS 가 돌기 전 한 프레임에 쓰인다)
      */}
      <div className={`hidden md:flex mx-auto max-w-5xl items-center justify-between gap-2 px-5 py-4 ${isHome ? "bg-transparent" : "bg-background/95 backdrop-blur-md"}`}>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5">
            {/* 시즌 스킨이 켜지면 로고에 모자를 씌운다(season.css). 꺼지면 로고만. */}
            <span className="season-logo">
              <Image
                src="/logo-white.png"
                alt=""
                width={92}
                height={64}
                priority
                className="h-10 w-auto"
              />
              <SeasonArt art="witch-hat" className="season-hat season-hat--header" />
            </span>
            <span className="whitespace-nowrap text-h3 font-extrabold tracking-tight text-foreground">
              우주이스케이프
            </span>
          </Link>
        </div>
        {admin ? (
          // 어드민: 자주 쓰는 운영 메뉴만. 나머지는 페이지 위 메뉴 줄(AdminNav)에 있다.
          <nav className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-2 rounded-md bg-amber-400 px-2 py-0.5 text-micro font-semibold text-black">어드민</span>
            {ADMIN_QUICK.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-body font-semibold transition-colors ${
                  isAdminMenuActive(pathname, item.href) ? "bg-glow text-glow-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
        <nav className="flex flex-wrap items-center gap-x-7 gap-y-1 text-h3 font-semibold text-muted">
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
        )}
      </div>

      {/* 모바일 헤더 */}
      <div className="md:hidden bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-4">
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-1.5">
              <span className="season-logo">
                <Image
                  src="/logo-white.png"
                  alt=""
                  width={92}
                  height={64}
                  priority
                  className="h-8 w-auto"
                />
                <SeasonArt art="witch-hat" className="season-hat season-hat--header" />
              </span>
              <span className="whitespace-nowrap text-body font-extrabold tracking-tight text-foreground">
                우주이스케이프
              </span>
            </Link>
            {admin && <span className="rounded-md bg-amber-400 px-2 py-0.5 text-micro font-semibold text-black">어드민</span>}
            </div>
          {/* 모바일 햄버거 버튼 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            /*
              ⚠️ 막대 3개는 24×18 이지만 **누르는 영역은 44×44** 다(-m-2.5 로
                 주변 여백을 먹어 레이아웃은 그대로 둔다). 손가락 기준 최소
                 크기다(Apple HIG 44pt · Material 48dp · WCAG 2.5.8).
            */
            className="-m-2.5 flex h-11 w-11 flex-col items-center justify-center gap-1.5 p-2.5 focus:outline-none"
            aria-label="메뉴"
          >
            <div className={`h-0.5 w-6 bg-foreground transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`h-0.5 w-6 bg-foreground transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`h-0.5 w-6 bg-foreground transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* 모바일 드롭다운 메뉴 — 어드민은 어드민 메뉴 전체를 묶음별로 */}
        {isMenuOpen && admin && (
          <div className="max-h-[75vh] overflow-y-auto border-t border-border bg-background">
            <nav className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4">
              {ADMIN_MENU.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-micro text-muted">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`rounded-lg px-3 py-2 text-body-sm font-semibold ${
                          isAdminMenuActive(pathname, item.href)
                            ? "bg-glow text-glow-foreground"
                            : "border border-border text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-end border-t border-border pt-3">
                <LogoutButton />
              </div>
            </nav>
          </div>
        )}
        {isMenuOpen && !admin && (
          <div className="border-t border-border bg-background">
            <div className="mx-auto max-w-5xl px-5 py-3">
              <nav className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-body font-semibold text-muted">
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
