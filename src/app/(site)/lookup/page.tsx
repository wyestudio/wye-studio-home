import type { Metadata } from "next";
import { LookupForm } from "@/components/lookup/LookupForm";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

export const metadata: Metadata = {
  title: "신청내역 조회",
  // 검색 결과에 올리지 않는다. 홈과 테마 페이지만 색인하기로 했다(2026-09-13).
  // 이 페이지들이 사이트링크로 딸려 나와 목록이 길어지는데, 정작 검색으로
  // 찾아 들어올 이유는 없는 화면들이다.
  // ⚠️ follow 는 살려둔다 — 크롤러가 여기 걸린 테마 링크는 계속 타고 가야 한다.
  robots: { index: false, follow: true },
  openGraph: { title: "우주이스케이프 | 신청내역 조회" },
  twitter: { title: "우주이스케이프 | 신청내역 조회" },
};

export default function LookupPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-6 text-2xl font-extrabold">신청내역 조회</h1>
      <LookupForm />
      <KakaoChannelButton />
    </div>
  );
}
