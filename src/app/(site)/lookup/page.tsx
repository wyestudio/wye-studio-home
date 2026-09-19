import type { Metadata } from "next";
import { LookupForm } from "@/components/lookup/LookupForm";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";
import { SCREEN_SECTION } from "@/components/contents/screenSection";

export const metadata: Metadata = {
  title: "신청내역 조회",
  // ⚠️ 본문(LookupForm)은 클라이언트에서 그려져 서버 HTML 에는 푸터밖에 없다.
  //    설명을 안 주면 구글이 옛 사이트 설명으로 떨어진다 — 9/13 에 지운
  //    "로테이션 소개팅 … 베타 오픈. 8/22" 가 이 페이지 설명으로 계속 나갔다.
  //    결과 페이지(/lookup/result)는 robots.ts 에서 막는다 — 개인정보가 뜬다.
  description:
    "우주이스케이프 신청내역 조회. 접수번호와 신청자 전화번호로 신청한 회차와 상태를 확인하세요.",
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
