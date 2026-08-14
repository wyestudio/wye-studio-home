import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-xs text-muted sm:py-8 sm:text-sm">
      <div className="mx-auto max-w-5xl px-5">
        <div className="space-y-2 sm:space-y-1">
          {/* 회사 정보 */}
          <p className="flex flex-wrap gap-x-2 gap-y-1">
            <span>우주이스케이프 (wouldyouescape)</span>
            <span>·</span>
            <span>사업자등록번호 820-04-03772</span>
            <span>·</span>
            <span>서울특별시 관악구 낙성대로 2 4층</span>
            <span>·</span>
            <span>이메일 wouldyouescape@gmail.com</span>
          </p>

          {/* 약관 링크 */}
          <p className="flex flex-wrap gap-x-2 gap-y-1">
            <Link href="/terms" className="hover:text-glow transition-colors">
              이용약관
            </Link>
            <span>·</span>
            <Link href="/terms#article-8" className="hover:text-glow transition-colors">
              환불정책
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-glow transition-colors">
              개인정보처리방침
            </Link>
          </p>

          {/* 카피라이트 */}
          <p>© 2026 WOULDYOUESCAPE. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
