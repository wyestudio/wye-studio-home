import type { Metadata } from "next";
import Link from "next/link";

/**
 * 없는 주소로 들어왔을 때.
 *
 * 2026-10-04 까지 이 파일이 없어서 **Next 기본 영어 화면**("This page could not
 * be found.")이 그대로 나갔다(UX 진단). 잠시 닫아 둔 소개 페이지(/about)도
 * notFound() 를 부르므로 같은 화면을 봤다.
 *
 * 이 화면은 루트 레이아웃 안에서 그려지므로 헤더·푸터가 붙는다 — 길을 잃은
 * 사람이 메뉴로 바로 돌아갈 수 있다.
 */
export const metadata: Metadata = {
  title: "없는 페이지",
  // 색인되면 검색 결과에 빈 페이지가 남는다.
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
      <p
        className="mb-3 text-micro font-extrabold uppercase tracking-[0.3em] text-muted"
        aria-hidden
      >
        404
      </p>
      <h1 className="text-h1 font-extrabold">이 행성은 아직 지도에 없어요</h1>
      <p className="mt-4 text-body text-muted">
        주소가 바뀌었거나, 사라진 페이지예요. 아래에서 다시 찾아보세요.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/contents"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-glow px-6 text-body font-semibold text-background transition-opacity hover:opacity-90 sm:px-8"
        >
          테마 보기
        </Link>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-border px-6 text-body font-semibold text-foreground transition-colors hover:border-glow sm:px-8"
        >
          처음으로
        </Link>
      </div>

      <p className="mt-10 text-body-sm text-muted">
        신청한 회차를 찾고 있다면{" "}
        <Link href="/lookup" className="font-semibold text-glow underline underline-offset-4">
          신청내역 조회
        </Link>
        에서 접수번호로 확인할 수 있어요.
      </p>
    </div>
  );
}
