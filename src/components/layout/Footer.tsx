import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border py-6 text-xs text-muted sm:py-8 sm:text-sm">
      <div className="mx-auto max-w-5xl px-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-start">
          {/* 왼쪽 컬럼 — 회사 정보 */}
          <div className="flex flex-col gap-1.5">
            <p>상호: 우주이스케이프 (wouldyouescape)</p>
            <p>사업자등록번호: 820-04-03772</p>
            <p>주소: 서울특별시 관악구 낙성대로 2 4층</p>
            <p>이메일: wouldyouescape@gmail.com</p>
            <p className="pt-1">© 2026 WOULDYOUESCAPE. All rights reserved.</p>
          </div>

          {/* 오른쪽 컬럼 — 약관 링크 */}
          <div className="flex flex-col gap-1.5 sm:items-end">
            <Link href="/terms" className="hover:text-glow transition-colors">
              이용약관
            </Link>
            <Link href="/terms#article-8" className="hover:text-glow transition-colors">
              환불정책
            </Link>
            <Link href="/privacy" className="hover:text-glow transition-colors">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
