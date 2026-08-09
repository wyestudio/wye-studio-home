import Link from "next/link";

// 휴면 처리(2026-08-09): 비회원 구매 플로우로 전환하며 로그인/계정 네비게이션은
// 제거함. 로그인 시스템 자체는 삭제하지 않고 보존 — 자세한 배경은 CLAUDE.md
// "설계 변경 이력" 참고.
export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="text-base font-extrabold tracking-tight text-brand">
          wye studio
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted">
          <Link href="/#sessions" className="hover:text-foreground">
            상품 소개
          </Link>
          <Link href="/lookup" className="hover:text-foreground">
            참여내역 조회
          </Link>
        </nav>
      </div>
    </header>
  );
}
