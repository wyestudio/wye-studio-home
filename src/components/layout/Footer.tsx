"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  const isSessionDetailPage = pathname ? /^\/sessions\/[^/]+\/?$/.test(pathname) : false;

  return (
    <footer className="border-t border-border py-6 text-xs text-muted sm:py-8 sm:text-sm">
      <div className="mx-auto max-w-5xl px-5">
        {/* 정보 + 링크 — 항상 좌/우 2열 */}
        <div className="flex justify-between items-start gap-6 sm:gap-8">
          {/* 왼쪽 컬럼 — 회사 정보 (모바일: 1열, sm이상: 2열 그리드) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 sm:gap-y-1.5">
            <p>상호: 우주이스케이프 (wouldyouescape)</p>
            <p>사업자등록번호: 820-04-03772</p>
            <p>주소: 서울특별시 관악구 낙성대로 2 4층</p>
            <p>이메일: wouldyouescape@gmail.com</p>
          </div>

          {/* 오른쪽 컬럼 — 약관 링크 */}
          <div className="flex flex-col items-end gap-1 sm:gap-1.5 shrink-0">
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

        {/* 카피라이트 — 정보+링크 그룹 아래 */}
        <p className="mt-3 sm:mt-4">© 2026 WOULDYOUESCAPE. All rights reserved.</p>

        {/* 상품 상세 페이지에서만 고정 CTA 바 위로 푸터 노출을 위한 여백 */}
        {isSessionDetailPage ? <div className="h-24" aria-hidden /> : null}
      </div>
    </footer>
  );
}
