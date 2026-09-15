import type { Metadata } from "next";
import { LookupForm } from "@/components/lookup/LookupForm";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { SCREEN_SECTION } from "@/components/contents/screenSection";

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
    /*
      입력칸 두 개뿐이라 위에 붙여 두면 아래가 텅 빈다. 테마 상세 첫 화면처럼 화면 높이를
      채우고 가운데보다 살짝 위에 둔다(SCREEN_SECTION). 폭·글자도 같은 비율로 키웠다.
    */
    <div className={`mx-auto w-full max-w-md px-5 sm:max-w-lg lg:max-w-xl ${SCREEN_SECTION}`}>
      <h1 className="mb-6 text-2xl font-extrabold sm:mb-8 sm:text-3xl lg:text-4xl">신청내역 조회</h1>
      <LookupForm />
      <KakaoChannelButton />
    </div>
  );
}
