import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../globals.css";
import "./forms.css";

/*
  단체 예약 공개 폼(/f/<코드>)의 껍데기 — 사이트 머리 · 바닥 없이 폼만 띄운다(관리자 개편 5단계).

  왜 (site) 바깥인가
    · **주소 자체가 열쇠다.** (site) 레이아웃에는 방문 발자취(VisitTracker) · GTM · Clarity 가 실려 있어, 그 안에 두면
      폼 주소가 분석 도구로 넘어간다. 여기에는 그 어느 것도 싣지 않는다.
    · 별 배경 · 마스코트 커서 · 복사 방지도 폼에는 방해다.

  ⚠️ 검색에 걸리지 않게 한다(noindex). referrer 로 주소가 새지 않게 no-referrer 를 건다. 응답 헤더로도 같은 것을
     next.config.ts 가 한 번 더 건다.
  ⚠️ 글꼴은 (site) 레이아웃과 같은 파일이다.
*/
const suit = localFont({
  src: "../(site)/fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
});

// SUIT 에 없는 기호(· – 등)만 담은 보조 글꼴. 설정은 (site)/layout.tsx 와 같다.
const wyeSymbols = localFont({
  src: "../(site)/fonts/WyeSymbols-Variable.woff2",
  variable: "--font-symbols",
  display: "swap",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "우주이스케이프 단체 설문",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

// forms.css 의 --background 와 같은 값이어야 주소창 둘레가 이어져 보인다.
export const viewport: Viewport = { themeColor: "#f5f6f8", colorScheme: "light" };

export default function FormLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${suit.variable} ${wyeSymbols.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="form-shell mx-auto min-h-screen w-full max-w-md px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
