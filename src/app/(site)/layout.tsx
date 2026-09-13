import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StarfieldCanvas } from "@/components/space/StarfieldCanvas";
import { MascotCursor } from "@/components/space/MascotCursor";
import { MascotSelectionProvider } from "@/components/space/MascotSelectionContext";
import TestEnvBanner from "@/components/layout/TestEnvBanner";
import { CopyProtectionProvider } from "@/components/layout/CopyProtection";
import "../globals.css";

// SUIT(가변 폰트, SIL OFL) — https://github.com/sun-typeface/SUIT
const suit = localFont({
  src: "./fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
});

// 갈무리11(SIL OFL) — https://github.com/quiple/galmuri
// 테마별로 골라 쓰는 8비트 도트 글꼴이라 기본 폰트가 아니다. preload 를 끄고
// 실제로 쓰는 화면에서만 받아오게 한다.
const galmuri = localFont({
  src: "./fonts/Galmuri11-Bold.woff2",
  variable: "--font-galmuri-src",
  display: "swap",
  weight: "400 700",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.wouldyouescape.com";
// 검색 결과에서 사이트 이름 바로 아래 보이는 한 줄이다. 홈뿐 아니라 설명을
// 따로 안 정한 페이지(컨텐츠·About·Notice 등) 전부가 이 문장을 쓴다.
// ⚠️ 소개팅 회차를 더 이상 운영하지 않아 2026-09-13에 그 문구를 뺐다.
const SITE_DESCRIPTION =
  "Would You Escape? 여러 팀이 동시에 경쟁하는 팀대항 이색 방탈출. 같이 갈 사람이 없어도 — 문만 열고 들어오세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "우주이스케이프",
    template: "우주이스케이프 | %s",
  },
  description: SITE_DESCRIPTION,
  // Google 은 keywords 메타를 아예 안 본다. 네이버 쪽을 위해 남겨둘 뿐이라
  // 지금 실제로 파는 것만 적는다(소개팅·커플매칭은 더 이상 운영하지 않는다).
  keywords: [
    "방탈출",
    "팀대항 방탈출",
    "파티형 방탈출",
    "이색 방탈출",
    "그룹 방탈출",
    "신림 방탈출",
    "우주이스케이프",
    "wouldyouescape",
  ],
  openGraph: {
    title: "우주이스케이프",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "우주이스케이프",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "우주이스케이프",
    description: SITE_DESCRIPTION,
  },
  verification: {
    other: {
      "naver-site-verification": "66e18faedf271c624d7ed1edfca8b421c6b02dbf",
    },
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "우주이스케이프",
  alternateName: ["WYE", "Would You Escape"],
  url: SITE_URL,
  logo: `${SITE_URL}/logo-black.png`,
  description: SITE_DESCRIPTION,
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${suit.variable} ${geistMono.variable} ${galmuri.variable} h-full antialiased`}
    >
      {GTM_ID ? (
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
      <body className="min-h-full flex flex-col">
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <CopyProtectionProvider>
          <MascotSelectionProvider>
            <StarfieldCanvas />
            <MascotCursor />
            <TestEnvBanner />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </MascotSelectionProvider>
        </CopyProtectionProvider>
      </body>
    </html>
  );
}
