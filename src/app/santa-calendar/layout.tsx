import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { VisitTracker } from "@/components/analytics/VisitTracker";
import { jua } from "@/components/xmas-game/xmasGameFont";
import "../globals.css";

/*
  크리스마스 게임 「산타의 어드벤트 캘린더」 화면의 껍데기 — 사이트 머리 · 바닥 없이 게임만 띄운다.

  왜 (site) 바깥인가
    (site) 레이아웃은 요청마다 호스트를 읽어서(headers) 그 안의 페이지는 전부 요청마다 서버에서 그려진다.
    게임 화면은 누가 열든 같은 화면이라 미리 구워 두고 그대로 내보낸다 — 여는 사람이 늘어도 서버가 돌지 않는다
    (wye-server-cost). 사이트 머리 · 커서 마스코트 · 시즌 배경도 게임에는 방해라 싣지 않는다.

  ⚠️ 글꼴은 (site) 레이아웃과 **같은 파일**을 가리킨다. 사이트에서 넘어온 손님은 이미 받아 둔 글꼴을 다시 쓴다.
  ⚠️ GTM · Clarity 는 싣지 않는다((site) 레이아웃이 호스트를 보고 싣는 것이라 여기서는 가릴 수 없다).
     판의 시작 · 결과는 방문 발자취(VisitTracker)에만 남는다.
*/
const suit = localFont({
  src: "../(site)/fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
});

// SUIT 에 없는 기호(− 등)만 담은 보조 글꼴. 설정은 (site)/layout.tsx 와 같다.
const wyeSymbols = localFont({
  src: "../(site)/fonts/WyeSymbols-Variable.woff2",
  variable: "--font-symbols",
  display: "swap",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
});

/** 휴대폰 상단 막대 색 — 게임 화면의 바탕(XmasGame.module.css 의 .root)과 맞춘다. */
const GAME_BACKGROUND = "#0f3d33";

// 공유 카드 그림의 주소를 만드는 기준 — (site) 레이아웃과 같은 값이다(운영 · 테스트가 도메인이 다르다)
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com"),
};

export const viewport: Viewport = { themeColor: GAME_BACKGROUND, colorScheme: "dark", viewportFit: "cover" };

export default function SantaCalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${suit.variable} ${wyeSymbols.variable} ${jua.variable} h-full antialiased`}>
      <body className="min-h-full" style={{ backgroundColor: GAME_BACKGROUND }}>
        {children}
        <VisitTracker />
      </body>
    </html>
  );
}
