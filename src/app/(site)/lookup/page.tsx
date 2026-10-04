import type { Metadata } from "next";
import { LookupForm } from "@/components/lookup/LookupForm";
import { KakaoChannelButton } from "@/components/ui/KakaoChannelButton";

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
      입력칸 두 개뿐이라 위에 붙여 두면 아래가 텅 빈다. 화면 높이를 채우고 가운데보다
      살짝 위에 둔다(pb 를 pt 보다 크게). 폭·글자도 같은 비율로 키웠다.

      ⚠️ 예전에는 테마 상세의 SCREEN_SECTION 을 빌려 썼다. 2026-10-04 에 상세의
         '한 화면에 블록 하나' 구조를 걷어내면서, 여기만 세로 중앙 정렬이 계속
         필요해 자체 클래스로 떼어 왔다.
    */
    <div className="mx-auto flex min-h-[72svh] w-full max-w-md flex-col justify-center px-5 pt-6 pb-[5svh] sm:max-w-lg md:min-h-[calc(100svh-6.25rem)] md:pt-8 md:pb-[10svh] lg:max-w-xl">
      <h1 className="mb-6 text-2xl font-extrabold sm:mb-8 sm:text-3xl lg:text-4xl">신청내역 조회</h1>
      <LookupForm />
      <KakaoChannelButton />
    </div>
  );
}
