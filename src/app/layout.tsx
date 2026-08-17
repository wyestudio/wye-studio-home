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
import "./globals.css";

// SUIT(가변 폰트, SIL OFL) — https://github.com/sun-typeface/SUIT
const suit = localFont({
  src: "./fonts/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wouldyouescape.com";
const SITE_DESCRIPTION =
  "방탈출과 로테이션 소개팅을 결합한 우주이스케이프 pre-open. 8/29 오후·저녁 회차 참가 신청.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "우주이스케이프",
    template: "우주이스케이프 | %s",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "방탈출",
    "소개팅",
    "로테이션 소개팅",
    "그룹 미팅",
    "커플매칭",
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
      className={`${suit.variable} ${geistMono.variable} h-full antialiased`}
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
        <MascotSelectionProvider>
          <StarfieldCanvas />
          <MascotCursor />
          <TestEnvBanner />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </MascotSelectionProvider>
      </body>
    </html>
  );
}
