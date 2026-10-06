"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  const isSessionDetailPage = pathname ? /^\/sessions\/[^/]+(?:\/apply)?\/?$/.test(pathname) : false;

  return (
    // 글자·여백은 테마 상세의 새 비율에 맞춰 한 단계 키웠다(2026-09-15).
    <footer className="border-t border-border py-6 text-body-sm text-muted sm:py-10 lg:py-14">
      <div className="mx-auto max-w-5xl px-5">
        {/* 정보 + 링크 — 항상 좌/우 2열 */}
        <div className="flex justify-between items-start gap-6 sm:gap-8">
          {/* 왼쪽 컬럼 — 회사 정보 (1열로 세로 나열) */}
          <div className="flex flex-col gap-1 sm:gap-1.5 lg:gap-2">
            <p>상호: 우주이스케이프 (wouldyouescape)</p>
            <p>사업자등록번호: 820-04-03772</p>
            <p>주소: 서울특별시 관악구 낙성대로 2 4층</p>
            <p>이메일: wouldyouescape@gmail.com</p>
          </div>

          {/* 오른쪽 컬럼 — 약관 링크 */}
          {/*
              ⚠️ 링크 높이가 16px 이라 손가락으로 집기 어려웠다(2026-10-05).
                 글자 크기는 그대로 두고 **누르는 영역만** 세로로 넓힌다(py-2.5).
                 대신 줄 사이 gap 을 없애 푸터 전체 높이는 거의 그대로다.
            */}
            <div className="flex shrink-0 flex-col items-end">
            <Link href="/terms" className="py-2.5 hover:text-glow transition-colors">
              이용약관
            </Link>
            <Link href="/terms#article-8" className="py-2.5 hover:text-glow transition-colors">
              환불정책
            </Link>
            <Link href="/privacy" className="py-2.5 hover:text-glow transition-colors">
              개인정보처리방침
            </Link>
          </div>
        </div>

        {/* 카피라이트 — 정보+링크 그룹 아래 */}
        <p className="mt-3 sm:mt-5 lg:mt-7">© 2026 WOULDYOUESCAPE. All rights reserved.</p>

        {/* 상품 상세 페이지에서만 고정 CTA 바 위로 푸터 노출을 위한 여백 */}
        {isSessionDetailPage ? <div className="h-24" aria-hidden /> : null}
      </div>
    </footer>
  );
}
