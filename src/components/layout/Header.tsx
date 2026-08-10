import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인/계정 네비게이션은
// 제거함. 로그인 시스템 자체는 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5">
            <Image
              src="/logo-black.png"
              alt=""
              width={92}
              height={64}
              priority
              className="logo-light h-7 w-auto"
            />
            <Image
              src="/logo-white.png"
              alt=""
              width={92}
              height={64}
              priority
              className="logo-dark h-7 w-auto"
            />
            <span className="text-base font-extrabold tracking-tight text-foreground">
              우주이스케이프
            </span>
          </Link>
          <div className="relative" aria-hidden>
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
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/contents" className="hover:text-foreground">
            Contents
          </Link>
          <Link href="/lookup" className="hover:text-foreground">
            Check
          </Link>
          <Link href="/notice" className="hover:text-foreground">
            Notice
          </Link>
        </nav>
      </div>
    </header>
  );
}
