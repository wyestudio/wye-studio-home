import type { Metadata } from "next";
import { LookupResult } from "@/components/lookup/LookupResult";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

export const metadata: Metadata = {
  title: "신청내역 조회결과",
  // 검색 결과에 올리지 않는다. 색인하는 것은 홈·Notice·신청내역 조회·테마뿐이다.
  // 이 페이지들이 사이트링크로 딸려 나와 목록이 길어지는데, 정작 검색으로
  // 찾아 들어올 이유는 없는 화면들이다.
  // ⚠️ follow 는 살려둔다 — 크롤러가 여기 걸린 테마 링크는 계속 타고 가야 한다.
  robots: { index: false, follow: true },
  openGraph: { title: "우주이스케이프 | 신청내역 조회결과" },
  twitter: { title: "우주이스케이프 | 신청내역 조회결과" },
};

export default function LookupResultPage() {
  return (
    // 결과 카드도 테마 상세 비율에 맞춰 넓힌다(640 → 큰 화면 768px).
    <div className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-14 lg:max-w-3xl lg:py-16">
      <LookupResult />
      <KakaoChannelButton />
    </div>
  );
}
